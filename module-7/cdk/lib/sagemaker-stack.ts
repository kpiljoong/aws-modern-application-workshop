import * as cdk from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class SageMakerStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);
    
    const mysfitsNotebookRole = new iam.Role(this, "MysfitsNotbookRole", {
      assumedBy: new ServicePrincipal("sagemaker.amazonaws.com")
    });
    
    const mysfitsNotebookPolicy = new iam.PolicyStatement();
    mysfitsNotebookPolicy.addActions('sagemaker:*',
            'ecr:GetAuthorizationToken',
            'ecr:GetDownloadUrlForLayer',
            'ecr:BatchGetImage',
            'ecr:BatchCheckLayerAvailability',
            'cloudwatch:PutMetricData',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:DescribeLogStreams',
            'logs:PutLogEvents',
            'logs:GetLogEvents',
            's3:CreateBucket',
            's3:ListBucket',
            's3:GetBucketLocation',
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject');
    mysfitsNotebookPolicy.addAllResources();
    
    const mysfitsNotebookPassRolePolicy = new iam.PolicyStatement();
    mysfitsNotebookPassRolePolicy.addActions('iam:PassRole');
    mysfitsNotebookPassRolePolicy.addAllResources();
    mysfitsNotebookPassRolePolicy.addCondition('StringEquals', {
          'iam:PassedToService': 'sagemaker.amazonaws.com',
    });
    
    new iam.Policy(this, "MysfitsNotebookPolicy", {
      policyName: "mysfits_notebook_policy",
      statements: [
        mysfitsNotebookPolicy,
        mysfitsNotebookPassRolePolicy
      ],
      roles: [mysfitsNotebookRole]
    });
    
    const notebookInstance = new sagemaker.CfnNotebookInstance(this, "MythicalMysfits-SageMaker-Notebook", {
        instanceType: "ml.t2.medium",
        roleArn: mysfitsNotebookRole.roleArn
    });
    
    const lambdaRepository = new codecommit.Repository(this, "RecommendationsLambdaRepository", {
      repositoryName: "MythicalMysfits-RecommendationsLambdaRepository"
    });
    
    new cdk.CfnOutput(this, "recommendationsRepositoryCloneUrlHttp", {
      value: lambdaRepository.repositoryCloneUrlHttp,
      description: "Recommendations Lambda Repository Clone Url HTTP"
    });
    
    new cdk.CfnOutput(this, "recommendationsRepositoryCloneUrlSsh", {
      value: lambdaRepository.repositoryCloneUrlSsh,
      description: "Recommendations Lambda Repository Clone Url SSH"
    });
  }
}
