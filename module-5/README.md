# 모듈 5: 사용자 행동 포착

![Architecture](/images/module-5/architecture-module-5.png)

**완료에 필요한 시간:** 30분

---
**시간이 부족한 경우:** `module-5/cdk`에 있는 완전한 레퍼런스 AWS CDK 코드를 참고하세요

---

**사용된 서비스:**
* [AWS CloudFormation](https://aws.amazon.com/cloudformation/)
* [AWS Kinesis Data Firehose](https://aws.amazon.com/kinesis/data-firehose/)
* [Amazon S3](https://aws.amazon.com/s3/)
* [Amazon API Gateway](https://aws.amazon.com/api-gateway/)
* [AWS Lambda](https://aws.amazon.com/lambda/)
* [AWS CodeCommit](https://aws.amazon.com/codecommit/)

### 개요
이제 신비한 미스핏츠 사이트가 시작되어 동작중입니다. 사용자가 웹사이트와 미스핏츠들과 어떻게 상호작용하는지 더 잘 이해할 수 있는 방법을 만들어 보겠습니다. 웹사이트에서 발생한 미스핏츠를 입양하고 좋아하는 사용자 행동을 분석하여 백엔드에서 데이터가 변경되도록 하는건 매우 쉬운 작업니다. 하지만 미스핏츠를 좋아하고 입양하는 *결정 전*의 사용자가 웹사이트에서 취한 행동을 이해하면 미래에 더 나은 사용자 경험을 설계하는데 도움을 주어 미스핏츠 들이 더 빠르게 입양되도록 할 수 있습니다. 이러한 통찰력을 수집할 수 있도록, 웹사이트 프론트엔드에서 사용자가 미스핏츠 프로필을 클릭할 때 마다 새로운 마이크로서비스 API에 작은 요청을 보내는 기능을 구현하겠습니다. 이러한 레코드는 서버리스 코드 함수에의해 실시간으로 처리되고, 집계 및 저장되어 향후 수행할 분석에 사용될 수 있습니다.

현대적인 애플리케이션 디자인 원칙은 집중적이고, 분리된 모듈식 서비스를 선호합니다. 그래서 지금까지 작업해온 기존 Mysfits 서비스 내에 추가적인 방법과 기능을 추가하는 대신, 미스핏츠 웹사이트에서 사용자 클릭 이벤트를 받는 목적의 새 분리된 서비스를 추가하겠습니다.

생성할 서버리스 실시간 처리 서비스 스택은 다음 AWS 리소스를 포함합니다:

* [**AWS Kinesis Data Firehose 전송 스트림**](https://aws.amazon.com/kinesis/data-firehose/): Kinesis Firehose는 데이터 레코드를 허용하고 Amazon S3 버킷 또는 Amazon Redshift 데이터 웨어하우스 클러스터를 비롯한 AWS 내의 여러 가능한 스토리지에 자동으로 적재하는 가용성이 높은 관리형 실시간 스트리밍 서비스입니다. 또, Kinesis Firehose는 **AWS Lambda**로 생성 된 서버리스 함수로 스트림이 수신 한 모든 레코드를 자동으로 전달할 수 있습니다. 이는 작성한 코드가 레코드가 적재되기 전과 구성된 저장소에 저장되기 전에 추가 처리 또는 변환을 수행 할 수 있도록 합니다.
* [**Amazon S3 버킷**](https://aws.amazon.com/s3/): 처리된 모든 클릭 이벤트 레코드가 파일에 적재되어 객체로 저장될 새로운 버킷.
* [**AWS Lambda 함수**](https://aws.amazon.com/lambda/): AWS Lambda를 통해 개발자는 필요한 로직만 포함되도록 코드를 작성하고, 코드를 배포, 호출, 인프라를 관리하지 않고도 높은 안정성과 확장성을 얻을 수 있도록 합니다. 여기서 서버리스 코드 함수는 AWS SAM으로 정의됩니다. Python으로 작성되어 AWS Lambda에 배포된 다음 전송 스트림에서 수신한 클릭 레코드를 처리하고 보강합니다. 우리가 작성한 코드는 매우 간단하며 후속 처리없이 웹사이트 프론트엔드에서 기능을 강화시킵니다. 이 함수는 클릭 레코드를 (웹사이트 프론트엔드에서 얻은 데이터 보다) 더 의미있게 만들기위해 클릭된 미스핏츠에 대한 추가 속성을 검색합니다. 하지만, 워크샵의 목적 상 이 코드는 레코드가 저장되기 전 실시간으로 필요한 추가 처리나 변환을 수행할 수 있는 서버리스 코드 함수를 포함한 아키텍처 가능성을 보여주기 위함입니다. Lambda 함수가 생성되고 Kinesis Firehose 전송 스트림이 해당 함수의 이벤트 소스로 구성되면, 전송 스트림은 클릭 레코드를 이벤트로 생성한 코드 함수에 자동으로 전달하고, 코드가 반환하는 응답을 받고, 업데이트된 레코드를 구성한 Amazon S3 버킷으로 전달합니다. 
* [**Amazon API Gateway REST API**](https://aws.amazon.com/api-gateway/): AWS Kinesis Firehose는 다른 AWS 서비스와 같이 서비스 API를 제공합니다. 우리의 경우 PutRecord 작업을 사용하여 사용자 클릭 이벤트 레코드를 전송 스트림에 넣습니다. 하지만, 웹사이트 프론트엔드가 Kinesis Firehose PutRecord API와 직접 통합되는 것을 원치 않습니다. 그렇게 하기위해서는 프론트엔트 코드내에서 AWS 자격증명을 관리하여 PutRecord API 호출을 위한 API에 권한을 부여하고, 의존하는 AWS API를 노출해야합니다 (악의적인 사이트 방문자가 전송 스트림에 사용자 행동을 이해하기 위한 목적을 방해하고 유해한 레코드를 추가하는 시도를 할 수도 있습니다). 대신에, Amazon API Gateway를 사용하여 Kinesis Firehose의 PutRecord API의 **AWS Service Proxy**를 생성할 것입니다. 이를 통해 요청의 프론트엔드에서 AWS 자격증명 관리가 필요없는 자체 공개 RESTful 엔드포인트를 만들 수 있습니다. 또, API Gateway의 요청 **mapping template**을 사용하여 자체 요청 페이로드 구조를 정의하고, 요청을 필요한 구조로 제한한 다음, 잘 구성된 요청을 Kinesis Firehose PutRecord API가 필요로하는 구조로 변환할 수 있습니다.
* [**IAM Roles**](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html): Kinesis Firehose는 Lambda 함수에 수신한 레코드를 이벤트로 전달하고, S3 버킷에 처리된 레코드를 전달할 수 있는 서비스 역할이 필요합니다. 또한, Amazon API Gateway API는 각 API 요청에 대해 Kinesis Firehose 내에서 PutRecord API를 호출할 수 있도록하는 새로운 역할이 필요합니다.

위에서 설명한 리소스를 만들기 전에 Lambda 함수 코드를 업데이트하고 수정해야합니다.

### 새 CodeCommit 리포지토리 생성

AWS Cloud Development Kit (CDK)를 사용하여 배포할 이 새로운 스택은 인프라 환경 리소스 뿐만 아니라 AWS Lambda가 스트리밍 이벤트 처리를 위해 실행할 애플리케이션 코드 자체도 포함됩니다.

AWS CDK를 사용하여 필요한 리소스를 생성하려면 `workshop/cdk/lib` 폴더에 `kinesis-firehose-stack.ts`라는 새 파일을 생성합니다:

```sh
cd ~/environment/workshop/cdk
touch lib/kinesis-firehose-stack.ts
```

방금 만든 파일 내에서 이전에 수행한 것 처럼 스켈레톤 CDK 스택 구조를 정의하며 클래스명을 `KinesisFirehoseStack`으로 지정합니다:

```typescript
import * as cdk from 'aws-cdk-lib';

export class KinesisFirehoseStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);
  }
}
```

작성할 코드를 위한 클래스 import 문을 정의합니다:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { ServicePrincipal }from 'aws-cdk-lib/aws-iam';
import { CfnDeliveryStream }from 'aws-cdk-lib/aws-kinesisfirehose';
```

KinesisFirehoseStack에 필요한 속성을 정의하는 인터페이스를 정의합니다:

```typescript
interface KinesisFirehoseStackProps extends cdk.StackProps {
  table: dynamodb.Table;
}
```

속성 객체가 필요하도록 KinesisFirehoseStack의 생성자를 변경합니다:

```typescript
  constructor(app: cdk.App, id: string, props: KinesisFirehoseStackProps) {
```

`KinesisFirehoseStack` 생성자에서, 우리가 작성할 Kinesis Firehose와 Lambda 코드에 사용할 CodeCommit 리포지토리를 추가합니다:

```typescript
const lambdaRepository = new codecommit.Repository(this, "ClicksProcessingLambdaRepository", {
  repositoryName: "MythicalMysfits-ClicksProcessingLambdaRepository"
});

new cdk.CfnOutput(this, "kinesisRepositoryCloneUrlHttp", {
  value: lambdaRepository.repositoryCloneUrlHttp,
  description: "Clicks Processing Lambda Repository Clone Url HTTP"
});

new cdk.CfnOutput(this, "kinesisRepositoryCloneUrlSsh", {
  value: lambdaRepository.repositoryCloneUrlSsh,
  description: "Clicks Processing Lambda Repository Clone Url SSH"
});
```

그런 다음 `bin/cdk.ts`의 CDK 애플리케이션 정의에 `KinesisFirehoseStack`을 추가합니다. 완료한 뒤의 `bin/cdk.ts` 파일은 다음처럼 보여야 합니다:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";
import { CiCdStack } from "../lib/cicd-stack";
import { DynamoDbStack } from '../lib/dynamodb-stack';
import { CognitoStack } from '../lib/cognito-stack';
import { APIGatewayStack } from "../lib/apigateway-stack";
import { KinesisFirehoseStack } from "../lib/kinesis-firehose-stack";

const app = new cdk.App();
new WebApplicationStack(app, "MythicalMysfits-Website");
const networkStack = new NetworkStack(app, "MythicalMysfits-Network");
const ecrStack = new EcrStack(app, "MythicalMysfits-ECR");
const ecsStack = new EcsStack(app, "MythicalMysfits-ECS", {
  vpc: networkStack.vpc,
  ecrRepository: ecrStack.ecrRepository
});
new CiCdStack(app, "MythicalMysfits-CICD", {
    ecrRepository: ecrStack.ecrRepository,
    ecsService: ecsStack.ecsService.service
});
const dynamoDbStack = new DynamoDbStack(app, "MythicalMysfits-DynamoDB", {
    vpc: networkStack.vpc,
    fargateService: ecsStack.ecsService.service
});
const cognito = new CognitoStack(app,  "MythicalMysfits-Cognito");
new APIGatewayStack(app, "MythicalMysfits-APIGateway", {
  userPoolId: cognito.userPool.userPoolId,
  loadBalancerArn: ecsStack.ecsService.loadBalancer.loadBalancerArn,
  loadBalancerDnsName: ecsStack.ecsService.loadBalancer.loadBalancerDnsName
});
new KinesisFirehoseStack(app, "MythicalMysfits-KinesisFirehose", {
    table: dynamoDbStack.table
});
```

`KinesisFirehoseStack` 구현이 아직 완료되지는 않았지만 지금까지 작성한 것을 배포해보겠습니다:

```sh
cdk deploy MythicalMysfits-KinesisFirehose
```

명령의 출력에서 `"Repository Clone Url HTTP"`의 값을 복사합니다. `https://git-codecommit.REPLACE_ME_REGION.amazonaws.com/v1/repos/MythicalMysfits-ClicksProcessingLambdaRepository` 형식이어야 합니다.

다음으로 새 리포지토리를 클론합니다:

```sh
cd ~/environment/
git clone REPLACE_ME_WITH_ABOVE_CLONE_URL lambda-streaming-processor
```

### Streaming 서비스 코드 베이스 복사

이제 작업 디렉토리를 새로운 리포지토리로 옮깁니다:

```
cd ~/environment/lambda-streaming-processor/
```

그런 다음 module-5 애플리케이션 구성요소를 이 새 리포지토리 디렉토리에 복사합니다:

```
cp -r ~/environment/workshop/source/module-5/app/streaming/* .
```

### Lambda 함수 패키지 및 코드 업데이트

#### pip를 사용하여 Lambda 함수 종속성 설치

`streamProcessor.py` 파일 내부의 코드를 보면, `requests`와 `os` Python 패키지를 사용하여 이전에 생성한 신비한 미스핏츠 서비스에 API 요청을 하는 것을 알 수 있습니다. 다른 AWS 고객이 다양한 버전의 다양한 라이브러리 등에 의존할 수 있으므로, 외부 라이브러리들은 AWS Lambda 런타임 환경에 자동으로 포함되지 않습니다. Lambda 서비스에 업로드하기 전에 모든 라이브러리 종속성을 Lambda 코드와 함께 패키지하여야 합니다. 이를 위해 Python 패키지 관리자 `pip`를 사용하겠습니다. Cloud9 터미널에서 다음 명령을 실행하여 필요한 패키지 및 종속성을 로컬로 설치합니다:

```
pip install requests -t .
```

이 명령이 완료되면, 리포지토리 디렉토리에서 몇 가지 추가 python 패키지들을 볼 수 있을 것입니다.

#### CodeCommit으로 코드 푸시

CodeCommit에 저장되도록 코드 변경 사항을 새 리포지토리에 커밋합니다:

```sh
git add .
git commit -m "New stream processing service."
git push
```

### 스트리밍 서비스 스택 생성

`cdk` 폴더로 돌아갑니다:

```sh
cd ~/environment/workshop/cdk
```

`KinesisFirehoseStack` 파일로 돌아가서, Kinesis Firehose 인프라를 정의합니다. 먼저, Kinesis Firehose 구현을 정의합니다:

```typescript
const clicksDestinationBucket = new s3.Bucket(this, "Bucket", {
  versioned: true
});

const lambdaFunctionPolicy =  new iam.PolicyStatement();
lambdaFunctionPolicy.addActions("dynamodb:GetItem");
lambdaFunctionPolicy.addResources(props.table.tableArn);

const mysfitsClicksProcessor = new lambda.Function(this, "Function", {
  handler: "streamProcessor.processRecord",
  runtime: lambda.Runtime.PYTHON_3_9,
  description: "An Amazon Kinesis Firehose stream processor that enriches click records" +
    " to not just include a mysfitId, but also other attributes that can be analyzed later.",
  memorySize: 128,
  code: lambda.Code.fromAsset("../../lambda-streaming-processor"),
  timeout: cdk.Duration.seconds(30),
  initialPolicy: [
    lambdaFunctionPolicy
  ],
  environment: {
    MYSFITS_API_URL: "REPLACE_ME_API_URL"
  }
});

const firehoseDeliveryRole = new iam.Role(this, "FirehoseDeliveryRole", {
  roleName: "FirehoseDeliveryRole",
  assumedBy: new ServicePrincipal("firehose.amazonaws.com"),
  externalIds: [cdk.Aws.ACCOUNT_ID]
});

const firehoseDeliveryPolicyS3Stm = new iam.PolicyStatement();
firehoseDeliveryPolicyS3Stm.addActions("s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject");
firehoseDeliveryPolicyS3Stm.addResources(clicksDestinationBucket.bucketArn);
firehoseDeliveryPolicyS3Stm.addResources(clicksDestinationBucket.arnForObjects('*'));

const firehoseDeliveryPolicyLambdaStm = new iam.PolicyStatement();
firehoseDeliveryPolicyLambdaStm.addActions("lambda:InvokeFunction");
firehoseDeliveryPolicyLambdaStm.addResources(mysfitsClicksProcessor.functionArn);

firehoseDeliveryRole.addToPolicy(firehoseDeliveryPolicyS3Stm);
firehoseDeliveryRole.addToPolicy(firehoseDeliveryPolicyLambdaStm);

const mysfitsFireHoseToS3 = new CfnDeliveryStream(this, "DeliveryStream", {
  extendedS3DestinationConfiguration: {
    bucketArn: clicksDestinationBucket.bucketArn,
    bufferingHints: {
      intervalInSeconds: 60,
      sizeInMBs: 50
    },
    compressionFormat: "UNCOMPRESSED",
    prefix: "firehose/",
    roleArn: firehoseDeliveryRole.roleArn,
    processingConfiguration: {
      enabled: true,
      processors: [
        {
          parameters: [
            {
              parameterName: "LambdaArn",
              parameterValue: mysfitsClicksProcessor.functionArn
            }
          ],
          type: "Lambda"
        }
      ]
    }
  }
});

new lambda.CfnPermission(this, "Permission", {
  action: "lambda:InvokeFunction",
  functionName: mysfitsClicksProcessor.functionArn,
  principal: "firehose.amazonaws.com",
  sourceAccount: cdk.Aws.ACCOUNT_ID,
  sourceArn: mysfitsFireHoseToS3.attrArn
});

const clickProcessingApiRole = new iam.Role(this, "ClickProcessingApiRole", {
  assumedBy: new ServicePrincipal("apigateway.amazonaws.com")
});

const apiPolicy = new iam.PolicyStatement();
apiPolicy.addActions("firehose:PutRecord");
apiPolicy.addResources(mysfitsFireHoseToS3.attrArn);
new iam.Policy(this, "ClickProcessingApiPolicy", {
  policyName: "api_gateway_firehose_proxy_role",
  statements: [
    apiPolicy
  ],
  roles: [clickProcessingApiRole]
});

const api = new apigw.RestApi(this, "APIEndpoint", {
    restApiName: "ClickProcessing API Service",
    endpointTypes: [ apigw.EndpointType.REGIONAL ]
});

const clicks = api.root.addResource('clicks');

clicks.addMethod('PUT', new apigw.AwsIntegration({
    service: 'firehose',
    integrationHttpMethod: 'POST',
    action: 'PutRecord',
    options: {
        connectionType: apigw.ConnectionType.INTERNET,
        credentialsRole: clickProcessingApiRole,
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              "application/json": '{"status":"OK"}'
            },
            responseParameters: {
              "method.response.header.Access-Control-Allow-Headers": "'Content-Type'",
              "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,PUT'",
              "method.response.header.Access-Control-Allow-Origin": "'*'"
            }
          }
        ],
        requestParameters: {
          "integration.request.header.Content-Type": "'application/x-amz-json-1.1'"
        },
        requestTemplates: {
          "application/json": `{ "DeliveryStreamName": "${mysfitsFireHoseToS3.ref}", "Record": { "Data": "$util.base64Encode($input.json('$'))" }}`
        }
    }
}), {
    methodResponses: [
      {
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": true,
          "method.response.header.Access-Control-Allow-Methods": true,
          "method.response.header.Access-Control-Allow-Origin": true
        }
      }
    ]
  }
);

clicks.addMethod("OPTIONS", new apigw.MockIntegration({
  integrationResponses: [{
    statusCode: "200",
    responseParameters: {
      "method.response.header.Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
      "method.response.header.Access-Control-Allow-Origin": "'*'",
      "method.response.header.Access-Control-Allow-Credentials":
        "'false'",
      "method.response.header.Access-Control-Allow-Methods":
        "'OPTIONS,GET,PUT,POST,DELETE'"
    }
  }],
  passthroughBehavior: apigw.PassthroughBehavior.NEVER,
  requestTemplates: {
    "application/json": '{"statusCode": 200}'
  }
}), {
    methodResponses: [
      {
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": true,
          "method.response.header.Access-Control-Allow-Methods": true,
          "method.response.header.Access-Control-Allow-Credentials": true,
          "method.response.header.Access-Control-Allow-Origin": true
        }
      }
    ]
  }
);
```

방금 작성한 코드에는 Mysfits 서비스 API의 ApiEndpoint로 대체되어야하는 행이 있습니다. 모듈 4에서 생성한 웹사이트 프론트엔드에 사용된 것과 동일한 서비스 ApiEndpoint입니다. 코드를 업데이트 합니다:

```typescript
  ## Replace "REPLACE_ME_API_URL" with the ApiEndpoint for your Mysfits service API, eg: 'https://ljqomqjzbf.execute-api.us-east-1.amazonaws.com/prod/'
  environment: {
    MYSFITS_API_URL: "REPLACE_ME_API_URL"
  }
```

이 서비스는 DynamoDB의 MysfitsTable과 통합을 담당합니다. DynamoDB 테이블과 직접 통합하는 Lambda 함수를 작성할 수도 있지만, 이는 첫 마이크로서비스의 목적을 방해하며 같은 테이블과 통합되는 복수개의 분리된 코드 베이스가 됩니다. 대신에 기존 서비스를 통하여 테이블과 통합함으로써 더 분리된 모듈식 아키텍처를 갖도록 합니다.

마지막으로 CDK 애플리케이션을 배포합니다:

```sh
cd ~/environment/workshop/cdk
cdk deploy MythicalMysfits-KinesisFirehose
```

다음 단계에서 필요한 API Gateway 엔드포인트를 기록해둡니다

### 서비스에 미스핏츠 프로필 클릭 보내기

#### 웹사이트 콘텐츠를 업데이트하고 새 사이트를 S3에 푸시

스트리밍 스택이 실행되고 동작하면, 사용자가 미스핏츠 프로필을 클릭할 때 마다 이벤트를 서비스로 보내는 JavaScript를 포함하는 새로운 버전의 신비한 미스핏츠 프론트엔드를 게시해야합니다.

새로운 index.html 파일은 `~/environment/workshop/source/module-5/web/index.html`에 위치하고 있습니다. 웹사이틩 새 버전을 `workshop/web`디렉토리에 복사합니다:

```sh
cp -r ~/environment/workshop/source/module-5/web/* ~/environment/workshop/web
```

이 파일에는 업데이트가 필요한 모듈-4와 동일한 플레이스홀더와 새 스트림 프로세싱 서비스 엔디포인트에 대한 추가 플레이스홀더를 포함하고 있습니다. `streamingApiEndpoint` 값은 앞에서 기록해둔 API Gateway 엔드포인트입니다.

이제 S3 호스팅 웹사이트를 업데이트하고 `MythicalMysfits-Website` 스택을 배포합니다:

```sh
cd ~/environment/workshop/cdk
cdk deploy MythicalMysfits-Website
```

브라우저에서 신비한 미스핏츠 웹사이트를 한번 더 새로고침하면 사용자가 미스핏츠 프로필을 클릭할 때마다 기록하고 게시하는 사이트를 볼 수 있습니다!

처리 된 레코드는 MythicalMysfitsStreamingStack의 일부로 생성된 대상 S3 버킷에 저장됩니다. S3 콘솔을 방문하여 스트리밍 레코드를 위해 생성한 버킷을 살펴보십시오 (`mythicalmysfits-kinesisfirehose-bucket...`의 접두사로 되어있을 것입니다):
[Amazon S3 Console](https://s3.console.aws.amazon.com/s3/home)

이것으로 모듈 5를 마치겠습니다.

### [모듈 6 진행](/module-6)


#### [AWS Developer Center](https://developer.aws)