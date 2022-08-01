import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';

interface CiCdStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  ecsService: ecs.FargateService;
}

export class CiCdStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: CiCdStackProps) {
    super(scope, id);
    
    const backendRepository = new codecommit.Repository(this, "BackendRepository", {
      repositoryName: "MythicalMysfits-BackendRepository"
    });
    
    const codebuildProject = new codebuild.PipelineProject(this, "BuildProject", {
      projectName: "MythicalMysfitsServiceCodeBuildProject",
      environment: {
        computeType: codebuild.ComputeType.SMALL,
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        privileged: true,
        environmentVariables: {
          AWS_ACCOUNT_ID: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: cdk.Aws.ACCOUNT_ID
          },
          AWS_DEFAULT_REGION: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: cdk.Aws.REGION
          }
        }
      }
    });
    
    const codeBuildPolicy = new iam.PolicyStatement();
    codeBuildPolicy.addResources(backendRepository.repositoryArn)
    codeBuildPolicy.addActions(
        "codecommit:ListBranches",
        "codecommit:ListRepositories",
        "codecommit:BatchGetRepositories",
        "codecommit:GitPull"
      )
    codebuildProject.addToRolePolicy(
      codeBuildPolicy
    );
    
    props.ecrRepository.grantPullPush(codebuildProject.grantPrincipal);

    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new actions.CodeCommitSourceAction({
      actionName: "CodeCommit-Source",
      branch: "master",
      trigger: actions.CodeCommitTrigger.EVENTS,
      repository: backendRepository,
      output: sourceOutput
    });
    
    const buildOutput = new codepipeline.Artifact();
    const buildAction = new actions.CodeBuildAction({
      actionName: "Build",
      input: sourceOutput,
      outputs: [
        buildOutput
      ],
      project: codebuildProject
    });
    
    const deployAction = new actions.EcsDeployAction({
      actionName: "DeployAction",
      service: props.ecsService,
      input: buildOutput,
      deploymentTimeout: cdk.Duration.minutes(15)
    });
    
    const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "MythicalMysfitsPipeline"
    });
    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction]
    });
    pipeline.addStage({
      stageName: "Build",
      actions: [buildAction]
    });
    pipeline.addStage({
      stageName: "Deploy",
      actions: [deployAction]
    });
    
    new cdk.CfnOutput(this, 'BackendRepositoryCloneUrlHttp', {
      description: 'Backend Repository CloneUrl HTTP',
      value: backendRepository.repositoryCloneUrlHttp
    });

    new cdk.CfnOutput(this, 'BackendRepositoryCloneUrlSsh', {
      description: 'Backend Repository CloneUrl SSH',
      value: backendRepository.repositoryCloneUrlSsh
    });
  }
}