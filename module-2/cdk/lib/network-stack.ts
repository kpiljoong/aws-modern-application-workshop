import * as cdk from 'aws-cdk-lib';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  
  constructor(scope: cdk.App, id:string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "VPC", {
        natGateways: 1,
        maxAzs: 2
    });
  }
}