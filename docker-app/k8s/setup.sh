#!/bin/bash

set -x

# 변수 설정 (리전, node role name, cluster 명)
export REGION=$1
export NODE_ROLE_NAME=$2
export CLUSTER_NAME=$3

export ALB_POLICY_NAME=alb-ingress-controller
policyExists=$(aws iam list-policies | jq '.Policies[].PolicyName' | grep alb-ingress-controller | tr -d '["\r\n]')
if [[ "$policyExists" != "alb-ingress-controller" ]]; then
    echo "Policy does not exist, creating..."
    export ALB_POLICY_ARN=$(aws iam create-policy --region=$REGION --policy-name $ALB_POLICY_NAME --policy-document "https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/master/docs/examples/iam-policy.json" --query "Policy.Arn" | sed 's/"//g')
    aws iam attach-role-policy --region=$REGION --role-name=$NODE_ROLE_NAME --policy-arn=$ALB_POLICY_ARN
fi

# Ingress Controller 생성
if [ ! -f alb-ingress-controller.yaml ]; then
    wget https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/v1.1.5/docs/examples/alb-ingress-controller.yaml
fi
sed -i "s/devCluster/$CLUSTER_NAME/g" alb-ingress-controller.yaml
sed -i "s/# - --cluster-name/- --cluster-name/g" alb-ingress-controller.yaml
kubectl apply -f https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/v1.1.5/docs/examples/rbac-role.yaml
kubectl apply -f alb-ingress-controller.yaml

# 확인
kubectl get pods -n kube-system

#Attach IAM policy to Worker Node Role
if [ ! -f iam-policy.json ]; then
    curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/master/docs/examples/iam-policy.json
fi
aws iam put-role-policy --role-name $NODE_ROLE_NAME --policy-name elb-policy --policy-document file://iam-policy.json

# Blue/Green PODS 초기화
kubectl apply -f devops-ALB-namespace.yaml
kubectl apply -f devopsALBBlue.yaml
kubectl apply -f devopsALBGreen.yaml

# 확인
kubectl get deploy -n devops-alb
kubectl get svc -n devops-alb
kubectl get pods -n devops-alb

# ingress 설정에 필요한 값 설정
sg=$(aws ec2 describe-security-groups --filters Name=tag:aws:cloudformation:stack-name,Values=CdkStackDevOps | jq '.SecurityGroups[0].GroupId' | tr -d '["]')
vpcid=$(aws ec2 describe-security-groups --filters Name=tag:aws:cloudformation:stack-name,Values=CdkStackDevOps | jq '.SecurityGroups[0].VpcId' | tr -d '["]')
subnets=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcid" "Name=tag:aws-cdk:subnet-name,Values=Public" | jq '.Subnets[0].SubnetId' | tr -d '["]')
subnets="$subnets, $(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcid" "Name=tag:aws-cdk:subnet-name,Values=Public" | jq '.Subnets[1].SubnetId' | tr -d '["]')"
subnets="$subnets, $(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcid" "Name=tag:aws-cdk:subnet-name,Values=Public" | jq '.Subnets[2].SubnetId' | tr -d '["]')"

# 적용
sed -i "s/public-subnets/$subnets/g" devopsALBIngress_query.yaml
sed -i "s/public-subnets/$subnets/g" devopsALBIngress_query2.yaml
sed -i "s/sec-grp/$sg/g" devopsALBIngress_query.yaml
sed -i "s/sec-grp/$sg/g" devopsALBIngress_query2.yaml
kubectl apply -f devopsALBIngress_query.yaml
