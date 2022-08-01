import * as cdk from 'aws-cdk-lib';

import path = require('path');

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export class WebApplicationStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);

    const webAppRoot = path.resolve(__dirname, '..', '..', 'web');
    const bucket = new s3.Bucket(this, "Bucket", {
      websiteIndexDocument: "index.html"
    });
    
    // Obtain the cloudfront origin access identity so that the s3 bucket may be restricted to it.
    const origin = new cloudfront.OriginAccessIdentity(this, "BucketOrigin", {
        comment: "mythical-mysfits"
    });
    
    // Restrict the S3 bucket via a bucket policy that only allows our CloudFront distribution
    bucket.grantRead(new iam.CanonicalUserPrincipal(
      origin.cloudFrontOriginAccessIdentityS3CanonicalUserId
    ));
    
    const cdn = new cloudfront.CloudFrontWebDistribution(this, "CloudFront", {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
      originConfigs: [
        {
          behaviors: [
            {
              isDefaultBehavior: true,
              maxTtl: undefined,
              allowedMethods:
                cloudfront.CloudFrontAllowedMethods.GET_HEAD_OPTIONS
            }
          ],
          s3OriginSource: {
            s3BucketSource: bucket,
            originAccessIdentity: origin,
            originPath: `/web`,
          }
        }
      ]
    });
    
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset(webAppRoot)
      ],
      destinationKeyPrefix: "web/",
      destinationBucket: bucket,
      distribution: cdn,
      distributionPaths: ['/*'],
      retainOnDelete: false
    });
    
    new cdk.CfnOutput(this, "CloudFrontURL", {
      description: "The CloudFront distribution URL",
      value: "https://" + cdn.distributionDomainName
    });
  }
}