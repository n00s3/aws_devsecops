#!/bin/bash

set -x

# 변수 설정 (리전, node role name, cluster 명)
export REGION=$1
export NODE_ROLE_NAME=$2
export CLUSTER_NAME=$3

echo "========================"
echo "------초기화 시작-----"
echo "========================"
rm devopsALBIngress_query.yaml
rm devopsALBIngress_query1.yaml
rm devopsALBIngress_query2.yaml
cp k8s_backup/devopsALBIngress_query.yaml devopsALBIngress_query.yaml
cp k8s_backup/devopsALBIngress_query1.yaml devopsALBIngress_query1.yaml
cp k8s_backup/devopsALBIngress_query2.yaml devopsALBIngress_query2.yaml
rm alb-ingress-controller.yaml
kubectl delete svc/devops-svc-alb-blue svc/devops-svc-alb-green svc/devops-svc-alb-api svc/devops-svc-alb-sonarqube svc/devops-svc-alb-owasp -n devops-alb
kubectl delete deploy/devops-deploy-alb-blue deploy/devops-deploy-alb-green deploy/devops-deploy-alb-api deploy/devops-deploy-alb-sonarqube deploy/devops-deploy-alb-owasp -n devops-alb
kubectl delete ingress alb-ingress -n devops-alb
kubectl delete deploy alb-ingress-controller -n kube-system
echo "======================"
echo "------초기화 종료-----"
echo "======================"
kubectl get deploy -n devops-alb
kubectl get svc -n devops-alb
kubectl get pods -n devops-alb
kubectl get ingress -n devops-alb
kubectl get pods -n kube-system
ls -al

echo "============================================"
echo "리소스 삭제 대기중 (5sec)"
sleep 5

export ALB_POLICY_NAME=alb-ingress-controller
policyExists=$(aws iam list-policies | jq '.Policies[].PolicyName' | grep alb-ingress-controller | tr -d '["\r\n]')
if [[ "$policyExists" != "alb-ingress-controller" ]]; then
    echo "정책이 존재하지 않아 생성합니다."
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
#kubectl logs -n kube-system $(kubectl get po -n kube-system | egrep -o "alb-ingress[a-zA-Z0-9-]+")

#Attach IAM policy to Worker Node Role
if [ ! -f iam-policy.json ]; then
    curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/master/docs/examples/iam-policy.json
fi
aws iam put-role-policy --role-name $NODE_ROLE_NAME --policy-name elb-policy --policy-document file://iam-policy.json

# Blue/Green PODS 초기화
kubectl apply -f devops-ALB-namespace.yaml
kubectl apply -f devopsALBBlue.yaml
kubectl apply -f devopsALBGreen.yaml
# API서버 초기화
kubectl apply -f devopsALBApi.yaml
# SonarQube
kubectl apply -f devopsALBSonarQube.yaml

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

# Ingress 적용
sed -i "s/public-subnets/$subnets/g" devopsALBIngress_query.yaml
sed -i "s/public-subnets/$subnets/g" devopsALBIngress_query1.yaml
sed -i "s/public-subnets/$subnets/g" devopsALBIngress_query2.yaml
sed -i "s/sec-grp/$sg/g" devopsALBIngress_query.yaml
sed -i "s/sec-grp/$sg/g" devopsALBIngress_query1.yaml
sed -i "s/sec-grp/$sg/g" devopsALBIngress_query2.yaml
#kubectl apply -f devopsALBIngress_query.yaml
kubectl apply -f devopsALBIngress_query1.yaml
#kubectl apply -f devopsALBIngress_query2.yaml


# 대시보드 설치
kubectl apply -f dashboard/k8sDashboard.yaml
kubectl apply -f dashboard/dashBoardAdminUser.yaml
kubectl apply -f dashboard/dashBoardRollbinding.yaml

echo "================"
echo "----출력확인----"
echo "================"
kubectl get deploy -n devops-alb
kubectl get svc -n devops-alb
kubectl get pods -n devops-alb
kubectl get ingress -n devops-alb
kubectl get pods -n kube-system
kubectl proxy &
echo "========================"
echo "----------완료----------"
echo "========================"

