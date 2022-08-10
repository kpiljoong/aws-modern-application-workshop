# 모듈 6: 애플리케이션 요청 추적

![Architecture](/images/module-6/x-ray-arch-diagram.png)

**완료에 필요한 시간:** 45분

---
**시간이 부족한 경우:** `module-6/cdk`에 있는 완전한 레퍼런스 AWS CDK 코드를 참고하세요

---

**사용된 서비스:**
* [AWS CloudFormation](https://aws.amazon.com/cloudformation/)
* [AWS X-Ray](https://aws.amazon.com/xray/)
* [Amazon DynamoDB](https://aws.amazon.com/dynamodb/)
* [Amazon Simple Notification Service (AWS SNS)](https://aws.amazon.com/sns/)
* [Amazon S3](https://aws.amazon.com/s3/)
* [Amazon API Gateway](https://aws.amazon.com/api-gateway/)
* [AWS Lambda](https://aws.amazon.com/lambda/)
* [AWS CodeCommit](https://aws.amazon.com/codecommit/)

### 개요

다음으로, [**AWS X-Ray**](https://aws.amazon.com/xray/)를 사용하여 신비한 미스핏츠 사이트에 새로운 기능에 대한 요청 동작을 심층적으로 검사하고 분석하는 방법을 보여주겠습니다. 새로운 기능을 통해 사용자는 사이트에 배치할 **Contact Us** 버튼을 통해 신비한 미스핏츠 직원에게 연락할 수 있습니다. 사용자 질문을 받아 처리하기 위한 새로운 마이크로서비스를 만드는데 필요한 많은 단계가 이 워크샵의 초기 단계에서 수행한 방법과 유사합니다.

우리가 만들 리소스는 다음과 같습니다:
* **API Gateway API**: 단일 REST 리소스 `/questions`를 갖는 새로운 마이크로서비스를 생성합니다. 이 API는 사용자 질문의 텍스트와 질문을 제출한 사용자의 이메일 주소를 받습니다.
* **DynamoDB Table**: 사용자 질문이 저장되고 유지될 새로운 DynamoDB 테이블. 이 DynamoDB 테이블은 [**DynamoDB Stream**](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)이 활성화되어 생성됩니다. 이 스트림은 즉시 처리할 수 있도록 데이터베이스 내에 저장된 모든 새 질문에 대한 실시간 이벤트 스트림을 제공합니다.
* **AWS SNS Topic**: AWS SNS를 통해 애플리케이션은 메시지를 게시하고 메시지 주제를 구독할 수 있습니다. 이메일 주소를 구독하는 이메일에 알림을 보내는 방법으로 새로운 주제를 사용합니다.
* 두개의 **AWS Lambda Functions**: AWS Lambda 함수 하나는 질문 API 요청에 대한 서비스 백엔드로 사용됩니다. 다른 AWS Lambda 함수는 질문 DynamoDB 테이블로부터 이벤트를 받아 각각에 대한 메시지를 위의 SNS 주제에 게시합니다. 이 리소스들을 정의할 때, `Tracing: Active`을 나타내는 속성을 사용합니다. 이는 Lambda 함수의 모든 호출이 자동으로 **AWS X-Ray**에 의해 추적됨을 의미합니다.
* **IAM Roles**: 위의 각 리소스 및 작업에 필요.

### 새 CodeCommit 리포지토리 생성

AWS CDK를 사용하여 필요한 리소스를 생성하기 위해 `workshop/cdk/lib` 폴더에 `xray-stack.ts`라는 파일을 생성합니다:

```sh
cd ~/environment/workshop/cdk
touch lib/xray-stack.ts
```

방금 생성한 파일 내에서 이전에 한 것처럼 스켈레톤 CDK 스택 구조를 정의합니다. 클래스명은 `XRayStack`로 합니다:

```typescript
import * as cdk from 'aws-cdk-lib';

export class XRayStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);
  }
}
```

작성할 코드를 위한 라이브러리들을 import 합니다:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as event from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
```

`XRayStack` 생성자 내에서 작성할 Lambda 코드에 사용할 CodeCommit 리포지토리를 추가합니다:

```typescript
const lambdaRepository = new codecommit.Repository(this, "QuestionsLambdaRepository", {
  repositoryName: "MythicalMysfits-QuestionsLambdaRepository"
});

new cdk.CfnOutput(this, "questionsRepositoryCloneUrlHttp", {
  value: lambdaRepository.repositoryCloneUrlHttp,
  description: "Questions Lambda Repository Clone Url HTTP"
});

new cdk.CfnOutput(this, "questionsRepositoryCloneUrlSsh", {
  value: lambdaRepository.repositoryCloneUrlSsh,
  description: "Questions Lambda Repository Clone Url SSH"
});
```

그런 다음 `XRayStack`를 `bin/cdk.ts`의 CDK 애플리케이션 정의에 추가합니다. 완료 후 `bin/cdk.ts`는 다음처럼 보여야 합니다:

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
import { XRayStack } from "../lib/xray-stack";

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
new XRayStack(app, "MythicalMysfits-XRay");
```

아직 `XRayStack` 구현 작성이 완료되지 않았지만 현재까지 작성한 것을 배포 해 봅니다:

```sh
cdk deploy MythicalMysfits-XRay
```

명령의 출력에서 `"Repository Clone Url HTTP"` 값을 복사합니다. 해당 값은 `https://git-codecommit.REPLACE_ME_REGION.amazonaws.com/v1/repos/MythicalMysfits-QuestionsLambdaRepository`의 형식이어야합니다.

다음으로 비어있는 새로 생성한 리포지토리를 클론합니다:

```sh
cd ~/environment/
git clone REPLACE_ME_WITH_ABOVE_CLONE_URL lambda-questions
```

### 질문 서비스 코드베이스 복사

새로운 리포지토리로 작업 디렉토리를 변경합니다:

```
cd ~/environment/lambda-questions/
```

그런 다음 모듈 6 애플리케이션 구성 요소를 새 리포지토리 디렉토리에 복사합니다:
```
cp -r ~/environment/workshop/source/module-6/app/* .
```

새로운 마이크로서비스를 위해 AWS Lambda 기능을 배포하고 호출하는데 필요한 모든 패키지가 포함되어 있습니다.

### 질문 서비스 스택 생성

`cdk` 폴더로 다시 변경합니다:

```sh
cd ~/environment/workshop/cdk
```

`XRayStack` 파일로 돌아가서, Question 마이크로서비스 인프라를 정의해보겠습니다:

```typescript
const table = new dynamodb.Table(this, "Table", {
  tableName: "MysfitsQuestionsTable",
  partitionKey: {
    name: "QuestionId",
    type: dynamodb.AttributeType.STRING
  },
  stream: dynamodb.StreamViewType.NEW_IMAGE
});

const postQuestionLambdaFunctionPolicyStmDDB =  new iam.PolicyStatement();
postQuestionLambdaFunctionPolicyStmDDB.addActions("dynamodb:PutItem");
postQuestionLambdaFunctionPolicyStmDDB.addResources(table.tableArn);

const LambdaFunctionPolicyStmXRay =  new iam.PolicyStatement();
LambdaFunctionPolicyStmXRay.addActions(
      //  Allows the Lambda function to interact with X-Ray
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets",
      "xray:GetSamplingStatisticSummaries"
    );
LambdaFunctionPolicyStmXRay.addAllResources();

const mysfitsPostQuestion = new lambda.Function(this, "PostQuestionFunction", {
  handler: "mysfitsPostQuestion.postQuestion",
  runtime: lambda.Runtime.PYTHON_3_6,
  description: "A microservice Lambda function that receives a new question submitted to the MythicalMysfits" +
                  " website from a user and inserts it into a DynamoDB database table.",
  memorySize: 128,
  code: lambda.Code.fromAsset("../../lambda-questions/PostQuestionsService"),
  timeout: cdk.Duration.seconds(30),
  initialPolicy: [
    postQuestionLambdaFunctionPolicyStmDDB,
    LambdaFunctionPolicyStmXRay
  ],
  tracing: lambda.Tracing.ACTIVE
});

const topic = new sns.Topic(this, 'Topic', {
    displayName: 'MythicalMysfitsQuestionsTopic',
    topicName: 'MythicalMysfitsQuestionsTopic'
});
topic.addSubscription(new subs.EmailSubscription("REPLACE@EMAIL_ADDRESS"));

const postQuestionLambdaFunctionPolicyStmSNS =  new iam.PolicyStatement();
postQuestionLambdaFunctionPolicyStmSNS.addActions("sns:Publish");
postQuestionLambdaFunctionPolicyStmSNS.addResources(topic.topicArn);

const mysfitsProcessQuestionStream = new lambda.Function(this, "ProcessQuestionStreamFunction", {
  handler: "mysfitsProcessStream.processStream",
  runtime: lambda.Runtime.PYTHON_3_6,
  description: "An AWS Lambda function that will process all new questions posted to mythical mysfits" +
                  " and notify the site administrator of the question that was asked.",
  memorySize: 128,
  code: lambda.Code.fromAsset("../../lambda-questions/ProcessQuestionsStream"),
  timeout: cdk.Duration.seconds(30),
  initialPolicy: [
    postQuestionLambdaFunctionPolicyStmSNS,
    LambdaFunctionPolicyStmXRay
  ],
  tracing: lambda.Tracing.ACTIVE,
  environment: {
    SNS_TOPIC_ARN: topic.topicArn
  },
  events: [
    new event.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 1
    })
  ]
});

const questionsApiRole = new iam.Role(this, "QuestionsApiRole", {
  assumedBy: new ServicePrincipal("apigateway.amazonaws.com")
});

const apiPolicy = new iam.PolicyStatement();
apiPolicy.addActions("lambda:InvokeFunction");
apiPolicy.addResources(mysfitsPostQuestion.functionArn);
new iam.Policy(this, "QuestionsApiPolicy", {
  policyName: "questions_api_policy",
  statements: [
    apiPolicy
  ],
  roles: [questionsApiRole]
});

const questionsIntegration = new apigw.LambdaIntegration(
  mysfitsPostQuestion,
  {
    credentialsRole: questionsApiRole,
    integrationResponses: [
      {
        statusCode: "200",
        responseTemplates: {
          "application/json": '{"status":"OK"}'
        }
      }
    ]
  }
);

const api = new apigw.LambdaRestApi(this, "APIEndpoint", {
  handler: mysfitsPostQuestion,
  proxy: false
});

const questionsMethod = api.root.addResource("questions");
questionsMethod.addMethod("POST", questionsIntegration, {
  methodResponses: [{
    statusCode: "200"
  }],
  authorizationType: apigw.AuthorizationType.NONE
});

questionsMethod.addMethod('OPTIONS', new apigw.MockIntegration({
  integrationResponses: [{
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Credentials': "'false'",
      'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
    },
  }],
  passthroughBehavior: apigw.PassthroughBehavior.NEVER,
  requestTemplates: {
    "application/json": "{\"statusCode\": 200}"
  },
}), {
  methodResponses: [{
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Credentials': true,
      'method.response.header.Access-Control-Allow-Origin': true,
    },  
  }]
});
```
> **참고:** 위 코드에서 "REPLACE@EMAIL_ADDRESS"를 접근 가능한 유효한 이메일 주소로 변경하세요. 이 값이 사용자 질문이 SNS 주제를 통하여 게시될 이메일 주소가 됩니다.

마지막으로 CDK 애플리케이션을 배포합니다:

```sh
cdk deploy MythicalMysfits-XRay
```

다음 단계에서 필요하므로 API Gateway 엔드포인트를 기록해둡니다.

다음으로 위에서 입력한 이메일 주소에 전달된 SNS 주제 구독 관련 이메일에서 구독 버튼을 눌러 승인합니다:
![SNS Confirm](/images/module-6/confirm-sns.png)

### 웹사이트 콘텐츠를 업데이트하고 새 사이트를 S3로 푸시

질문 스택이 구성되어 동작하면 신비한 미스핏츠 프론트엔드의 새 버전을 게시해야합니다.

새로운 index.html 파일은 다음에 위치하고 있습니다: `~/environment/workshop/source/module-6/web/index.html`. `workshop/web` 디렉토리에 웹사이트의 새 버전을 복사합니다:

```sh
cp -r ~/environment/workshop/source/module-6/web/* ~/environment/workshop/web
```

이 파일에는 모듈 5와 동일한 업데이트가 필요한 플레이스홀더와 새 질문 서비스 엔드포인트를 위한 추가적인 플레이스홀더를 포함하고 있습니다. `questionsApiEndpoint` 값은 앞에서 기록해둔 API Gateway 엔드포인트입니다.

이제 S3 호스팅 웹사이트를 업데이트하고 `MythicalMysfits-Website` 스택을 배포합니다:

```sh
cdk deploy MythicalMysfits-Website
```

새로운 Contact Us 기능이 배포되었으므로 웹사이트를 방문하고 질문을 제출해봅니다. 위 단계에서 SNS 구독을 승인하였다면, 해당 질문이 편지함에 도착한 것을 볼 수 있을 것입니다! 이메일 도착을 확인한 후, 요청 라이프사이클을 탐색하고 분석하는 단계로 넘어갈 수 있습니다.

### 질문 서비스 추적 및 요청 탐색

이제 마이크로서비스에 대한 요청 동작을 확인하기위해, AWS X-Ray 콘솔을 방문하여 탐색해봅니다:

[AWS X-Ray Console](https://console.aws.amazon.com/xray/home)

X-Ray 콘솔을 방문하면 **service map**을 확인할 수 있습니다. 이는 X-Ray가 **trace segments**를 받는 모든 구성 요소 간의 종속성 관계를 표시하는 것입니다:

![X-Ray Lambda Only](/images/module-6/lambda-only-x-ray.png)

처음에는 이 서비스 맵에 AWS Lambda 함수들만 포함됩니다. X-Ray 콘솔을 탐색하여 배포한 리소스에 `Tracing: Active` 속성을 나열한 것만으로도 자동으로 보여지는 데이터에 대해 자세히 알아볼 수 있습니다.

### AWS X-Ray를 사용하여 추가 AWS 서비스 구성(instrument)

다음으로, 모든 서비스 종속성이 서비스 맵과 기록된 추적 세그먼트에 포함되도록 마이크로서비스 스택을 구성하겠습니다.

먼저 API Gateway REST API를 구성합니다. `XRayStack` 스택에서, API Gateway 리소스를 수정하여 추적을 활성화합니다:

```typescript
const api = new apigw.LambdaRestApi(this, "APIEndpoint", {
  handler: mysfitsPostQuestion,
  proxy: false,
  deployOptions: {
    tracingEnabled: true
  }
});
```

그런 다음 CDK 스택을 다시 배포합니다:

```sh
cdk deploy MythicalMysfits-XRay
```

신비한 미스핏츠 웹사이트에 다른 질문을 제출하면 REST API가 서비스 맵에도 포함되어 있는걸 확인할 수 있습니다!

![API Gateway Traced](/images/module-6/api-x-ray.png)

다음으로, [AWS X-Ray SDK for Python](https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-python.html)을 사용하여 질문 스택의 일부로서 2개의 Lambda 함수에 의해 불려지는 서비스들도 X-Ray 서비스 맵에 나타나도록 합니다. 작성된 코드가 이미 있으며, 관련 줄의 주석만 제거하면 됩니다 (주석 제거는 python 코드 앞에 `#`를 삭제하여 수행합니다). Lambda 함수 코드에서 `#UNCOMMENT_BEFORE_2ND_DEPLOYMENT` 또는 `#UNCOMMENT_BEFORE_3RD_DEPLOYMENT`를 나타내는 주석을 볼 수 있을 것입니다.  

AWS CDK를 사용하여 이러한 기능의 첫번째 배포를 이미 완료했으므로, 이번이 **2번째 배포**가 됩니다. 다음 파일에서 `UNCOMMENT_BEFORE_2ND_DEPLOYMENT`가 표시된 모든 부분에 주석을 제거하고 필요한 변경을 수행한 후 파일을 저장합니다:
* `~/environment/lambda-questions/PostQuestionsService/mysfitsPostQuestion.py`
* `~/environment/lambda-questions/ProcessQuestionsStream/mysfitsProcessStream.py`

> **참고:** 주석 처리를 해제하면 AWS X-Ray SDK가 AWS Python SDK (boto3)를 구성하여 추적 데이터를 캡처하고 Lambda 서비스 내에서 기록하게 합니다. X-Ray가 AWS Lambda를 사용하는 서버리스 애플리케이션에서 자동으로 AWS 서비스 맵을 추적하는데는 몇 줄의 코드만 있으면 됩니다!

이러한 변경을 수행한 후, 다음 두 명령을 실행하여 Lambda 함수 코드에 대한 업데이트를 배포합니다:

```sh
cdk deploy MythicalMysfits-XRay
```

명령이 완료되면 신비한 미스핏츠 웹사이트에서 추가 질문을 제출하고, X-Ray 콘솔을 다시 확인합니다. 이제 Lambda가 DynamoDB 뿐만 아니라 SNS와 어떻게 상호작용하는지 추적할 수 있습니다!

![Services X-Ray](/images/module-6/services-x-ray.png)

### AWS X-Ray 관련 문제 해결

이번 모듈의 마지막 단계는 AWS X-Ray를 사용하여 애플리케이션의 문제를 심사하는데 익숙해지는 것입니다. 이를 위해, 우리가 *미스핏츠*가 되어 애플리케이션에 끔찍한 코드를 추가하도록 하겠습니다. 이 코드는 웹서비스에 5초의 대기시간을 추가하고 무작위 요청에 대해 예외를 발생시키는 것입니다 :) .

다음 파일로 돌아가서 `#UNCOMMENT_BEFORE_3RD_DEPLOYMENT`로 표시된 주석을 제거합니다:  
* `~/environment/lambda-questions/PostQuestionsService/mysfitsPostQuestion.py`

주석을 제거한 부분이 Lambda 함수가 예외를 발생시키게 하는 코드입니다. 또한, `hangingException()` 함수 위에서 **AWS X-Ray SDK**의 기본 기능을 사용하여 함수가 호출될 때마다 추적 세그먼트를 기록하고 있음을 알 수 있습니다. 이제 특정 요청에 대한 추적을 자세히 살펴보면, 예외가 발생하기 전에 모든 요청이 함수 내에서 적어도 5초 동안 멈춰있는 걸 확인할 수 있습니다.

운영하는 애플리케이션 내에서 이 기능을 사용하면 코드 내의 위와 비슷한 지연 병목현상이나 예외가 발생하는 위치를 식별하는데 도움이 됩니다.

필요한 코드를 변경하고 `mysfitsPostQuestion.py` 파일을 저장한 후, 변경 사항을 배포하기 전에 이전과 동일한 명령을 실행합니다:

```sh
cdk deploy MythicalMysfits-XRay
```

이 명령을 실행한 후, 미스핏츠 웹사이트에서 다른 몇 가지 질문을 제출해보겠습니다. 질문 중 몇개는 이메일 편지함에 나타나지 않을 것이고, 이는 새로운 끔찍한 코드가 오류를 발생시켰기 때문입니다!

X-Ray 콘솔을 다시 방문하면, MysfitPostQuestionsFunction Lambda 함수의 서비스 맵에 더 이상 녹색이 아닌 링이 있는걸 알 수 있습니다. 이는 오류 응답이 생겼기 때문입니다. X-Ray는 서비스맵에있는 모든 구성된 서비스들의 전반적인 서비스 상태를 시각적으로 보여줍니다.

![X-Ray Errors](/images/module-6/x-ray-errors.png)

서비스 맵에서 해당 서비스를 클릭하면 X-Ray 콘솔의 오른쪽에 서비스 지연 그래프 내에 보여지는 강조된 전체 지연과 일치하는 트레이스 및/또는 관심 가질만한 응답 코드 볼 수 있습니다. 지연 그래프를 확대하여 5초 주위의 문제가 보여지도록 하거나 Error 체크 박스를 선택하고 **View traces**를 클릭합니다:

![View Traces](/images/module-6/view-traces.png)

그러면 추적 대시보드로 이동되어, 특정 요청 라이프사이클을 탐색하고, 각 세그먼트에 대한 지연 시간을 보고, 스택 트레이스와 연관된 보고된 예외를 볼 수 있습니다. 응답이 502로 보고된 추적 중 아무 ID나 클릭하여 나타나는 **Trace Details** 페이지에서 **hangingException**을 클릭하면 코드에서 예외가 발생한 곳의 특정 하위 세그먼트를 볼 수 있습니다:

![Exception](/images/module-6/exception.png)

축하합니다, 모듈 6을 완료했습니다!

### [모듈 7 진행](/module-7)

#### [AWS Developer Center](https://developer.aws)