
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecr = require('@aws-cdk/aws-ecr');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import codebuild = require('@aws-cdk/aws-codebuild');
import BuildSpec = require('@aws-cdk/aws-codebuild');
import codecommit = require('@aws-cdk/aws-codecommit');
import targets = require('@aws-cdk/aws-events-targets');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import * as lambda from '@aws-cdk/aws-lambda';
import * as path from 'path';
import * as s3 from '@aws-cdk/aws-s3';
import * as securityhub from '@aws-cdk/aws-securityhub';
import * as guardduty from '@aws-cdk/aws-guardduty';

export class CdkStackDevOps extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create a new VPC with single NAT Gateway
     */
    const vpc = new ec2.Vpc(this, 'NewVPC', {
      cidr: '10.0.0.0/16',
      natGateways: 1
    });



    const clusterAdmin = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.AccountRootPrincipal()
    });

    const cluster = new eks.Cluster(this, 'Cluster', {
      vpc,
      defaultCapacity: 2,
      defaultCapacityInstance: new ec2.InstanceType('t3.large'), //default m5
      mastersRole: clusterAdmin,
      outputClusterName: true,
    });

    const ecrRepo = new ecr.Repository(this, 'EcrRepo', {
      imageScanOnPush: true
    });

    const repository = new codecommit.Repository(this, 'CodeCommitRepo', {
      repositoryName: `${this.stackName}-repo`,
    });


    // LAMBDA 생성
    const fn_sechub = new lambda.Function(this, 'SecurityImport', {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'import_findings_security_hub.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-functions/securityhub')),
    });
    const fn_slack = new lambda.Function(this, 'SlackNotify', {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'slack.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-functions/slack')),
    });

    
    // S3 저장소 생성
    const s3Bucket = new s3.Bucket(this, 'reportBucket', {
      versioned: true
    });

    
    // Guardduty 활성화
    // const sechub = new securityhub.CfnHub()
    // const guard = new guardduty.CfnDetector(this, "GuardDutyDetector", { enable: true })
    
    
    
    // CODEBUILD - projectOnCommit
    const projectOnCommit = new codebuild.Project(this, 'MyProjectCommit', {
      projectName: `${this.stackName}`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2,
        privileged: true
      },
      environmentVariables: {
        'LAMBDA_FUNCTION_SLACK': {
          value: `${fn_slack.functionName}`
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: [
              'cp $CODEBUILD_SRC_DIR/lambda-functions/slack/event.json event.json',
              'commitID=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-8)',
              'titleA="CodeCommit-"',
              'titleB=$(echo commitID:$commitID)',
              'user=$CODEBUILD_INITIATOR',
              'sed -i "s/example subject/$titleA$titleB/g" event.json',
              'sed -i "s/test message/$user 사용자가 master 브랜치에 push 했습니다./g" event.json',
              'aws lambda invoke --function-name $LAMBDA_FUNCTION_SLACK --payload file://event.json dependency-check-report.json  && echo "LAMBDA_SUCCEDED" || echo "LAMBDA_FAILED"',
            ]
          }
        }
      })
    })
    
      
    
    
    
    
    // CODEBUILD - projectSCA SCA
    const projectSCA = new codebuild.Project(this, 'MyProjectSCA', {
      projectName: `${this.stackName}SCA`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0,
        privileged: true
      },
      environmentVariables: {
        'CLUSTER_NAME': {
          value: `${cluster.clusterName}`
        },
        'ECR_REPO_URI': {
          value: `${ecrRepo.repositoryUri}`
        },
        'LAMBDA_FUNCTION_SECURITY': {
          value: `${fn_sechub.functionName}`
        },
        'LAMBDA_FUNCTION_SLACK': {
          value: `${fn_slack.functionName}`
        }
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec/buildspec-owasp-depedency-check.yml')
    })

    // CODEBUILD - projectSAST SAST
    const projectSAST = new codebuild.Project(this, 'MyProjectSAST', {
      projectName: `${this.stackName}SAST`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0,
        privileged: true
      },
      environmentVariables: {
        'CLUSTER_NAME': {
          value: `${cluster.clusterName}`
        },
        'ECR_REPO_URI': {
          value: `${ecrRepo.repositoryUri}`
        },
        'LAMBDA_FUNCTION_SECURITY': {
          value: `${fn_sechub.functionName}`
        },
        'LAMBDA_FUNCTION_SLACK': {
          value: `${fn_slack.functionName}`
        },
        'SonarQube_URL': {
          value: 'http://sonarqube.6cicd.net'
        },
        'SonarQube_Access_Token': {
          value: '0123456789'
        },
        'SonarQube_ProjectKey': {
          value: 'devsecops'
        }
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec/buildspec-sonarqube.yml')
    })
    
    


    // CODEBUILD - project BuildAndDeploy
    const project = new codebuild.Project(this, 'MyProject', {
      projectName: `${this.stackName}BuildAndDeploy`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromAsset(this, 'CustomImage', {
          directory: '../dockerAssets.d',
        }),
        privileged: true
      },
      environmentVariables: {
        'CLUSTER_NAME': {
          value: `${cluster.clusterName}`
        },
        'ECR_REPO_URI': {
          value: `${ecrRepo.repositoryUri}`
        },
        'LAMBDA_FUNCTION_SECURITY': {
          value: `${fn_sechub.functionName}`
        },
        'LAMBDA_FUNCTION_SLACK': {
          value: `${fn_slack.functionName}`
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              'env',
              'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}',
              '/usr/local/bin/entrypoint.sh'
            ]
          },
          build: {
            commands: [
              'cd docker-app',
              'npm install',
              'npm run build',
              `docker build -t $ECR_REPO_URI:$TAG .`,
              '$(aws ecr get-login --no-include-email)',
              'docker push $ECR_REPO_URI:$TAG'
            ]
          },
          post_build: {
            commands: [
              'kubectl get nodes -n devops-alb',
              'kubectl get deploy -n devops-alb',
              'kubectl get svc -n devops-alb',
              "isDeployed=$(kubectl get deploy -n devops-alb -o json | jq '.items[0]')",
              "deploy8080=$(kubectl get svc -n devops-alb -o wide | grep 8080: | tr ' ' '\n' | grep app= | sed 's/app=//g')",
              "echo $isDeployed $deploy8080",
              "if [[ \"$isDeployed\" == \"null\" ]]; then kubectl apply -f k8s/devopsALBBlue.yaml && kubectl apply -f k8s/devopsALBGreen.yaml; else kubectl set image deployment/$deploy8080 -n devops-alb devops=$ECR_REPO_URI:$TAG; fi",
              'cp $CODEBUILD_SRC_DIR/lambda-functions/slack/event.json event.json',
              'titleA="BuildAndDeploy-"',
              'titleB=$(echo $CODEBUILD_BUILD_ID | tr ":" "\n" | grep "-" | cut -c 1-8)',
              'sed -i "s/example subject/$titleA$titleB/g" event.json',
              'sed -i "s/test message/테스트 배포 성공/g" event.json',
              'aws lambda invoke --function-name $LAMBDA_FUNCTION_SLACK --payload file://event.json dependency-check-report.json  && echo "LAMBDA_SUCCEDED" || echo "LAMBDA_FAILED"',
              'kubectl get deploy -n devops-alb',
              'kubectl get svc -n devops-alb'
            ]
          }
        }
      })
    })
    
    // CODEBUILD - projectDAST DAST
    const projectDAST = new codebuild.Project(this, 'MyProjectDAST', {
      projectName: `${this.stackName}DAST`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2,
        privileged: true
      },
      environmentVariables: {
        'CLUSTER_NAME': {
          value: `${cluster.clusterName}`
        },
        'ECR_REPO_URI': {
          value: `${ecrRepo.repositoryUri}`
        },
        'hostname': {
          value: 'http://test.6cicd.net'
        },
        'LAMBDA_FUNCTION_SECURITY': {
          value: `${fn_sechub.functionName}`
        },
        'LAMBDA_FUNCTION_SLACK': {
          value: `${fn_slack.functionName}`
        }
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec/buildspec-owasp-zap.yml')
    })



    // CODEBUILD - project2 SWAP
    const project2 = new codebuild.Project(this, 'MyProject2', {
      projectName: `${this.stackName}SWAP`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromAsset(this, 'CustomImage2', {
          directory: '../dockerAssets.d',
        }),
        privileged: true
      },
      environmentVariables: {
        'CLUSTER_NAME': {
          value: `${cluster.clusterName}`
        },
        'ECR_REPO_URI': {
          value: `${ecrRepo.repositoryUri}`
        },
        'LAMBDA_FUNCTION_SECURITY': {
          value: `${fn_sechub.functionName}`
        },
        'LAMBDA_FUNCTION_SLACK': {
          value: `${fn_slack.functionName}`
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              'env',
              'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}',
              '/usr/local/bin/entrypoint.sh'
            ]
          },
          build: {
            commands: [
              'cd docker-app',
              'echo "Dummy Action"'
            ]
          },
          post_build: {
            commands: [
              'kubectl get nodes -n devops-alb',
              'kubectl get deploy -n devops-alb',
              'kubectl get svc -n devops-alb',
              "deploy8080=$(kubectl get svc -n devops-alb -o wide | grep ' 8080:' | tr ' ' '\n' | grep app= | sed 's/app=//g')",
              "deploy80=$(kubectl get svc -n devops-alb -o wide | grep ' 80:' | tr ' ' '\n' | grep app= | sed 's/app=//g')",
              "echo $deploy80 $deploy8080",
              "kubectl patch svc devops-svc-alb-blue -n devops-alb -p '{\"spec\":{\"selector\": {\"app\": \"'$deploy8080'\"}}}'",
              "kubectl patch svc devops-svc-alb-green -n devops-alb -p '{\"spec\":{\"selector\": {\"app\": \"'$deploy80'\"}}}'",
              'cp $CODEBUILD_SRC_DIR/lambda-functions/slack/event.json event.json',
              'titleA="SWAP-"',
              'titleB=$(echo $CODEBUILD_BUILD_ID | tr ":" "\n" | grep "-" | cut -c 1-8)',
              'sed -i "s/example subject/$titleA$titleB/g" event.json',
              'sed -i "s/test message/정식 배포 성공/g" event.json',
              'aws lambda invoke --function-name $LAMBDA_FUNCTION_SLACK --payload file://event.json dependency-check-report.json  && echo "LAMBDA_SUCCEDED" || echo "LAMBDA_FAILED"',
              'kubectl get deploy -n devops-alb',
              'kubectl get svc -n devops-alb'
            ]
          }
        }
      })
    })




    // Artifact 버켓 생성
    //const ArtifactBucket = new codepipeline.Artifact();
    // PIPELINE 생성
    const sourceOutput = new codepipeline.Artifact();
    
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository,
      output: sourceOutput,
    });
    
    
    const SCA = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild-SCA',
      project: projectSCA,
      input: sourceOutput
      // outputs: [new codepipeline.Artifact()], // optional
    });
    
    const SAST = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild-SAST',
      project: projectSAST,
      input: sourceOutput
    });
    

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: project,
      input: sourceOutput
    });
    
    const DAST = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: projectDAST,
      input: sourceOutput
    });


    const buildAction2 = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: project2,
      input: sourceOutput,
    });


    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Approve',
    });
    

    new codepipeline.Pipeline(this, 'Port8999Pipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'ApproveBuild',
          actions: [manualApprovalAction],
        },
        {
          stageName: 'SCAandSAST',
          actions: [SCA, SAST],
        },
        {
          stageName: 'BuildandDeploy',
          actions: [buildAction],
        },
        {
          stageName: 'DAST',
          actions: [DAST],
        },
        {
          stageName: 'ApproveSwapBG',
          actions: [manualApprovalAction],
        },
        {
          stageName: 'SwapBG',
          actions: [buildAction2],
        },
      ],
    });
    
    


    repository.onCommit('OnCommit', {
      target: new targets.CodeBuildProject(codebuild.Project.fromProjectArn(this, 'OnCommitEvent', projectOnCommit.projectArn)),
      branches: ['master']
    });
  

    
    fn_sechub.grantInvoke(projectSCA.role!)
    fn_sechub.grantInvoke(projectSAST.role!)
    fn_sechub.grantInvoke(projectDAST.role!)
    fn_sechub.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:*', 'securityhub:*', 'logs:*'],
      resources: ['*'],
    }))
  
    fn_slack.grantInvoke(project.role!)
    fn_slack.grantInvoke(project2.role!)
    fn_slack.grantInvoke(projectSCA.role!)
    fn_slack.grantInvoke(projectSAST.role!)
    fn_slack.grantInvoke(projectDAST.role!)
    fn_slack.grantInvoke(projectOnCommit.role!)

    ecrRepo.grantPullPush(project.role!)
    cluster.awsAuth.addMastersRole(project.role!)
    project.addToRolePolicy(new iam.PolicyStatement({
      actions: ['eks:DescribeCluster'],
      resources: [`${cluster.clusterArn}`],
    }))

    ecrRepo.grantPullPush(project2.role!)
    cluster.awsAuth.addMastersRole(project2.role!)
    project2.addToRolePolicy(new iam.PolicyStatement({
      actions: ['eks:DescribeCluster'],
      resources: [`${cluster.clusterArn}`],
    }))




    new cdk.CfnOutput(this, 'CodeCommitRepoName', { value: `${repository.repositoryName}` })
    new cdk.CfnOutput(this, 'CodeCommitRepoArn', { value: `${repository.repositoryArn}` })
    new cdk.CfnOutput(this, 'CodeCommitCloneUrlSsh', { value: `${repository.repositoryCloneUrlSsh}` })
    new cdk.CfnOutput(this, 'CodeCommitCloneUrlHttp', { value: `${repository.repositoryCloneUrlHttp}` })
    new cdk.CfnOutput(this, 'S3Bucket', { value: `${s3Bucket.bucketName}` })
    new cdk.CfnOutput(this, 'lambdaSecurityHub', { value: `${fn_sechub.functionName}` })
    new cdk.CfnOutput(this, 'lambdaSlack', { value: `${fn_slack.functionName}` })
  }
}
