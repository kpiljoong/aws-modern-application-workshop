import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export class EcrStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: cdk.App, id: string) {
    super(scope, id);
    this.ecrRepository = new ecr.Repository(this, "Repository", {
      repositoryName: "mythicalmysfits/service"
    });
  }
}