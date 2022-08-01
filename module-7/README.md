# Module 7: 머신 러닝을 통한 Mysfit 추천

![Architecture](/images/module-7/sagemaker-architecture.png)

**완료에 필요한 시간:** 45분

---
**시간이 부족한 경우:** `module-7/cdk`에 있는 완전한 레퍼런스 AWS CDK 코드를 참고하세요

---

**사용된 서비스:**

* [Amazon SageMaker](https://aws.amazon.com/sagemaker/)
* [AWS CloudFormation](https://aws.amazon.com/cloudformation/)
* [Amazon S3](https://aws.amazon.com/s3/)
* [Amazon API Gateway](https://aws.amazon.com/api-gateway/)
* [AWS Lambda](https://aws.amazon.com/lambda/)
* [AWS CodeCommit](https://aws.amazon.com/codecommit/)

## 개요

가장 빠르게 성장하고 있는 기술 영역 중 하나는 머신 러닝입니다. 고성능 컴퓨팅 환경을 활용하는 비용이 계속 감소함에 따라 머신 러닝 알고리즘을 경제적으로 적용할 수 있는 사용 사례가 천문학적으로 증가했습니다. 이 머신 러닝 기술을 사용하여 MythicalMysfits.com 방문자가 자신에게 가장 적합한 미스핏츠를 찾을 수 있도록 도울 수 있습니다. 이번 모듈에서는 이 작업을 수행해보도록 하겠습니다.

완전 관리형 머신 러닝 서비스인 Amazon SageMaker를 사용하여 신비한 미스핏슻츠 사이트에 새로운 머신 러닝 기반 추천 엔진을 도입하겠습니다. 사이트 방문자는 자신에 대한 세부 정보를 제공하고, 해당 정보를 사용하여 머신 러닝 학습 모델을 호출하여 가장 적합한 미스핏츠를 예측합니다. Amazon SageMaker는 다음과 같은 도구들을 제공합니다:
* 모델 교육을 위한 데이터 준비 (S3에 저장된 샘플 데이터를 사용)
* SageMaker가 제공하는 많은 이미 구현된 머신 러닝 알고리즘을 중 하나를 사용하여 머신 러닝 모델을 학습하고 모델의 정확성을 평가
* 애플리케이션(신비한 미스핏츠 사이트)에서 확장성 있는 추론 기능을 제공하기 위해 생성된 모델을 저장 및 배포

## 머신 러닝 모델 구축

#### 데이터의 중요성
어떠한 머신 러닝 여정이라도 시작하기 앞서 데이터 수집을 해야 합니다. 이 데이터는 사용 사례에 대한 알고리즘의 이해와 정확한 예측/추론 능력을 정의합니다. 불충분하거나, 관련이 없거나, 부정확한 데이터를 사용한 머신 러닝을 애플리케이션에 추가하는 것은 이익보다 더 큰 불이익을 불러오는 위험성이 있습니다.

하지만 우리의 미스핏츠 사이트에서는, 미스핏츠 권장을 하기위한 방대한 양의 정확하고 역사적인 입양 데이터를 가지고 있지않습니다. 그래서 대신에 무작위로 많은 양의 데이터를 생성해서 사용하고자 합니다. 즉, 우리가 구축할 모델은 무작위 데이터를 기반으로 예측을 하게되어 "정확도"에 좋지 않은 영향을 줍니다. 이 데이터 세트를 사용하면 실제 애플리케이션에서 SageMaker를 사용하는 *방법*에 익숙해 질 수 있습니다. 하지만, 머신 러닝에 성공적으로 사용될 적절한 데이터 세트를 식별, 수집, 선별하기위한 실세계에서 필요한 중요한 단계들은 대충 넘어가도록 하겠습니다.

### SageMaker로 호스팅 노트북 인스턴스 생성

데이터를 큐레이션하고 알고리즘을 정의 및 실행하고 모델을 구축하는 등의 작업을 철저히 문서화하려는 데이터 과학자와 개발자는 **노트북** 이라는 단일 장소를 활용합니다. 머신 러닝에 사전 구성 및 최적화되어 있고 이미 [Jupyter Notebooks](http://jupyter.org/) 애플리케이션이 실행중인 EC2 인스턴스를 **노트북 인스턴스**라고 하며, AWS SageMaker를 통해 생성할 수 있습니다. 노트북 인스턴스를 생성하기 위해 노트북이 필요한 것들을 먼저 준비해두어야 합니다. 즉, 노트북 인스턴스에 필요한 모든 것들을 수행할 권한을 부여할 IAM 역할이 필요합니다.

AWS CDK를 사용하여 필요한 리소스들을 생성하기 위해 `workshop/cdk/lib` 폴더에 `sagemaker-stack.ts` 이라는 파일을 생성합니다:

```sh
cd ~/environment/workshop/cdk
touch lib/sagemaker-stack.ts
```

방금 생성한 파일에서 이전과 같이 스켈레톤 CDK Stack 구조를 정의하고 클래스명을 `SageMakerStack`으로 지정합니다:

```typescript
import * as cdk from 'aws-cdk-lib';

export class SageMakerStack extends cdk.Stack {
  constructor(app: cdk.App, id: string) {
    super(app, id);
  }
}
```

코드에서 사용할 모듈을 import합니다:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as iam from "aws-cdk-lib/aws-iam";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
```

`SageMakerStack` 생성자에서, IAM 역할과 노트북 인스턴스를 추가하고, 나중에 사용할 CodeCommit 리포지토리도 추가합니다:

```typescript
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
```

그리고 `bin/cdk.ts` 파일의 CDK 애플리케이션 정의에 `SageMakerStack`를 추가합니다. 완료 후 `bin/cdk.ts`는 다음처럼 보여야 합니다:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkStack } from '../lib/cdk-stack';
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
import { SageMakerStack } from "../lib/sagemaker-stack";

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
new SageMakerStack(app, "MythicalMysfits-SageMaker");
```

아직 `SageMakerStack` 구현이 완료 되진 않았지만, 작성한 것까지만 배포해보도록 하겠습니다:

```sh
cdk deploy MythicalMysfits-SageMaker
```

> **참고:** 노트북 인스턴스가 `Pending` 상태에서 `InService`까지 바뀌는데 약 10분 정도 걸릴 수 있습니다. 이 작업이 완료되는 동안 다음 과정으로 진행해도 괜찮습니다.

명령의 결과물 중 이후 과정에서 필요한 `"Repository Clone Url HTTP"` 값을 기록해둡니다. 해당 값은 다음과 같은 형식입니다: `https://git-codecommit.REPLACE_ME_REGION.amazonaws.com/v1/repos/MythicalMysfits-RecommendationsLambdaRepository`.

복제한 리포지토리 안에 이후 과정에서 사용할 다운로드가 필요한 파일이 있습니다. Cloud9의 파일 탐색기(File Explorer)에서 `~/environment/workshop/source/module-7/sagemaker/mysfit_recommendations_knn.ipynb` 파일을 찾고, 마우스 오른쪽 버튼 클릭을 한 후 다운로드(Download)를 누릅니다. 파일을 로컬 디렉토리에 저장하신 후 이후 사용하기 위해 위치를 기억해둡니다.

### Amazon SageMaker 사용

다음으로, 브라우저에서 새 탭을 열고 SageMaker 콘솔로 이동합니다 (워크샵이 진행 중인 리전과 동일한 리전인지 확인 하시기 바랍니다):
[Amazon SageMaker Console](https://console.aws.amazon.com/sagemaker/home)

**Notebook Instances**을 클릭합니다.

AWS CDK를 통해 생성된 **MythicalMysfits-SageMaker-Notebook** 인스턴스 옆의 라디오 버튼을 클릭하고 **Open Jupyter**를 클릭합니다. 이를 통해 노트북 인스턴스에서 동작중인 Jupyter Notebook 애플리케이션으로 이동할 수 있습니다.

![SageMaker Notebook Instances](/images/module-7/sagemaker-notebook-instances.png)

> **참고**: 워크샵'만'을 위해, 우리가 생성한 노트북 인스턴스는 서비스가 관리하는 VPC에서 동작하며 인터넷을 통해 바로 접근이 가능합니다. 이후 실제 사용시에 고려되어야 하는 VPC 인터페이스 엔드포인트를 통한 노트북 접근에 대해 더 자세히 알아보기 위해서는 [이 문서](https://docs.aws.amazon.com/sagemaker/latest/dg/notebook-interface-endpoint.html)를 참고하시기 바랍니다.

Jupyter가 열리면 다음과 같은 노트북 인스턴스의 홈페이지를 볼 수 있습니다:
![Jupyter Home](/images/module-7/jupyter-home.png)

**Upload** 버튼을 클릭하고, 이전 섹션에서 다운로드 받은 파일 `mysfit_recommendations_knn.ipynb`을 찾습니다. 그리고 파일이 표시되는 라인의 오른쪽에 있는 **Upload**를 클릭 합니다. 이 작업은 방금 업로드한 노트북 파일을 사용할 Jupyter안의 노트북 인스턴스에 새로운 노트북 문서를 생성할 것입니다.

모델을 작성하는데 필요한 코드를 가이드하는데 필요한 노트북을 미리 작성해두었습니다.

#### 호스팅된 노트북을 사용하여 모델 구축, 교육, 배포

Jupyter 애플리케이션에서 방금 업로드한 파일이름을 클릭하면, 새로운 브라우저 탭이 열리며 작업을 진행할 노트북 문서가 보일 것 입니다.

# 잠시!

노트북 문서의 지시사항을 따라 질문에 대한 응답을 기반으로 사용자에게 가장 적합한 신비한 미스핏츠를 예측하기위해 SageMaker 엔드포인트를 배포합니다.

노트북 내의 과정을 모두 완료한 뒤, 다음을 진행합니다.

## 예측 모델을 위한 서버리스 REST API 생성

이제 SageMaker 엔드포인트를 배포했으니, 이 엔드포인트에 신비한 미스핏츠 서버리스 REST API를 통합하겠습니다. 이를 통해 API를 우리가 필요한 사양에 맞게끔 정의하고 프론트엔드 애플리케이션 코드가 지속적으로 네이티브 AWS 서비스 API가 아닌 우리가 정의한 API와 통합되도록 합니다. API Gateway 및 AWS Lambda를 사용하여 마이크로서비스를 서버리스가 되도록 합니다.

이미 추천 서비스 코드가 커밋될 새로운 CodeCommit 리포지토리를 생성했었습니다. 이 리포지토리를 Cloud9 환경에 클론하기 위해 이전에 기록해둔 `cloneUrlHttp` 속성을 사용합니다 (예, `https://git-codecommit.REPLACE_ME_REGION.amazonaws.com/v1/repos/MythicalMysfits-RecommendationsLambdaRepository`).

다음으로 리포지토리를 클론합니다:

```sh
cd ~/environment/
git clone REPLACE_ME_WITH_ABOVE_CLONE_URL lambda-recommendations
```

### Recommendations 서비스 코드베이스 복사

이제 클론한 리포지토리로 이동합니다:
```
cd ~/environment/lambda-recommendations/
```

그런 다음, module-7 애플리케이션 구성요소들을 새 리포지토리 디렉토리에 복사합니다:

```
cp -r ~/environment/workshop/source/module-7/app/* .
```

API를 배포하기 전 서비스 Python 코드에 변경해야하는 코드가 있습니다. Cloud9에서 `~/environment/lambda-recommendations/service/recommendation.py` 파일을 열면, 교체해야하는 한 줄(`REPLACE_ME_SAGEMAKER_ENDPOINT_NAME`)이 보일 것 입니다.

필요한 값을 얻기 위해 다음 CLI 명령을 실행하여 SageMaker 엔드포인트를 읽어옵니다:

```
aws sagemaker list-endpoints > ~/environment/sagemaker-endpoints.json
```

`sagemaker-endpoints.json` 파일을 열고 `knn-ml-m4-xlarge-` 접두사가 붙은 EndpointName 값을 복사합니다 (이 접두사는 Jupyter 노트북 내부에서 엔드포인트 이름의 접두사로 지정한 것입니다).

`recommendation.py` 파일에 EndpointValue 이름을 붙여넣고 저장합니다.

### Questions 서비스 스택 생성

다시 `cdk` 폴더로 이동합니다:

```sh
cd ~/environment/workshop/cdk
```

`SageMakerStack` 파일로 돌아가, Recommendations 마이크로서비스 인프라를 정의하겠습니다:

```typescript
const recommandationsLambdaFunctionPolicyStm =  new iam.PolicyStatement();
recommandationsLambdaFunctionPolicyStm.addActions("sagemaker:InvokeEndpoint");
recommandationsLambdaFunctionPolicyStm.addAllResources();

const mysfitsRecommendations = new lambda.Function(this, "Function", {
  handler: "recommendations.recommend",
  runtime: lambda.Runtime.PYTHON_3_6,
  description: "A microservice backend to invoke a SageMaker endpoint.",
  memorySize: 128,
  code: lambda.Code.asset("../../lambda-recommendations/service"),
  timeout: cdk.Duration.seconds(30),
  initialPolicy: [
    recommandationsLambdaFunctionPolicyStm
  ]
});

const questionsApiRole = new iam.Role(this, "QuestionsApiRole", {
  assumedBy: new ServicePrincipal("apigateway.amazonaws.com")
});

const apiPolicy = new iam.PolicyStatement();
apiPolicy.addActions("lambda:InvokeFunction");
apiPolicy.addResources(mysfitsRecommendations.functionArn);
new iam.Policy(this, "QuestionsApiPolicy", {
  policyName: "questions_api_policy",
  statements: [
    apiPolicy
  ],
  roles: [questionsApiRole]
});

const questionsIntegration = new apigw.LambdaIntegration(
  mysfitsRecommendations,
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
  handler: mysfitsRecommendations,
  options: {
    restApiName: "Recommendation API Service"
  },
  proxy: false
});

const recommendationsMethod = api.root.addResource("recommendations");
recommendationsMethod.addMethod("POST", questionsIntegration, {
  methodResponses: [{
    statusCode: "200",
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Origin': true,
    }
  }],
  authorizationType: apigw.AuthorizationType.NONE
});

recommendationsMethod.addMethod('OPTIONS', new apigw.MockIntegration({
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

마지막으로, CDK 애플리케이션을 배포합니다:

```sh
cdk deploy MythicalMysfits-SageMaker
```

이 명령이 완료되면, Jupyter 노트북을 통해 작성한 SageMaker 엔드포인트에 대한 REST API 마이크로서비스 래퍼를 배포되게 됩니다. 이후에 필요한 Recommendations API Gateway 엔드포인트를 기록해둡니다.

curl을 사용하는 다음 CLI 명령으로 새로 배포한 서비스를 테스트해보겠습니다. 훈련 데이터에서 사용한 CSV 라인과 일치하는 새로운 데이터 포인트에 대한 추천이 표시됩니다. 바로 위에서 기록해둔 API Gateway 엔드포인트 값을 통해 REST API를 호출합니다. 아래처럼 엔드포인트 뒤에 /recommendations 을 붙여야합니다:

```
curl -d '{"entry": [1,2,3,4,5]}' REPLACE_ME_RECOMMENDATION_API_ENDPOINT/recommendations -X POST
```

다음과 같은 응답을 요청의 결과로 받아야 합니다:
```
{"recommendedMysfit": "c0684344-1eb7-40e7-b334-06d25ac9268c"}
```

이제 이 새로운 백엔드 기능을 신비한 미스핏츠 웹사이트에 통합할 준비가 되었습니다.

### 웹사이트 콘텐츠를 업데이트하고 새 사이트를 S3에 푸시

사용자에게 Mysfit 추천 질문지를 제공하고 추천 미스핏츠를 보여주는 데 필요한 코드가 포함된 새로운 `index.html` 파일이 모듈 7에 포함되어 있습니다.

![Recommendation Button SS](/images/module-7/recommendation-button-ss.png)

웹사이트의 새 버전을 `workshop/web` 디렉토리에 복사합니다:

```sh
cp -r ~/environment/workshop/source/module-7/web/* ~/environment/workshop/web
```

이 파일에는 모듈 6에서와 동일한 업데이트가 필요한 플리에스홀더와 추가적인 새 추천 서비스 엔드포인트를 위한 플레이스홀더가 포함되어 있습니다. `recommendationsApiEndpoint` 값이 앞서 기록해둔 API Gateway 엔드포인트입니다.

이제 S3 호스팅 웹사이트를 업데이트하고 `MythicalMysfits-Website` 스택을 배포합니다:

```sh
npm run build
cdk deploy MythicalMysfits-Website
```

이제 웹사이트에서 **Recommend a Mysfit** 버튼을 통해 질문에 대한 선택된 응답을 가지고 추천 마이크로서비스에 보내어 선호도에 맞는 mysfit를 추천해주는 걸 확인할 수 있습니다.

축하합니다 모듈 7을 완료했습니다!


### 워크샵 정리

#### 모듈 7 정리:
배포된 엔드포인트를 삭제하기 위해 SageMaker 노트북에 코드를 추가해두었습니다. 노트북으로 돌아가 이전에 완료한 다음 코드 셀을 실행하여 엔트포인트를 중단하여 추가 비용을 방지할 수 있습니다.

#### 일반적인 워크샵 정리
의도치 않은 과금을 방지하기 위해 워크샵 중 생성된 리소스 모두를 삭제해야합니다. AWS 콘솔을 통해 생성한 리소스를 확인하고 제거할 준비가되면 리소스를 삭제하시기 바랍니다.

AWS CloudFormation을 사용하여 리소스를 프로비저닝한 경우 각 스택에 대해 다음 CLI 명령을 실행하여 해당 리소스를 제거할 수 있습니다:

```
cdk destroy
```

신비한 미스핏츠 워크샵 진행 중 생성된 리소스 전부를 지우기 위해 아래의 AWS 콘솔에 접속해보시기 바랍니다:
* [Amazon SageMaker](https://console.aws.amazon.com/sagemaker/home)
* [AWS Kinesis](https://console.aws.amazon.com/kinesis/home)
* [AWS Lambda](https://console.aws.amazon.com/lambda/home)
* [Amazon S3](https://console.aws.amazon.com/s3/home)
* [Amazon API Gateway](https://console.aws.amazon.com/apigateway/home)
* [Amazon Cognito](https://console.aws.amazon.com/cognito/home)
* [AWS CodePipeline](https://console.aws.amazon.com/codepipeline/home)
* [AWS CodeBuild](https://console.aws.amazon.com/codebuild/home)
* [AWS CodeCommit](https://console.aws.amazon.com/codecommit/home)
* [Amazon DynamoDB](https://console.aws.amazon.com/dynamodb/home)
* [Amazon ECS](https://console.aws.amazon.com/ecs/home)
* [Amazon EC2](https://console.aws.amazon.com/ec2/home)
* [Amazon VPC](https://console.aws.amazon.com/vpc/home)
* [AWS IAM](https://console.aws.amazon.com/iam/home)
* [AWS CloudFormation](https://console.aws.amazon.com/cloudformation/home)

# 정리

워크샵을 통해 전달하고 싶었던 것은 AWS를 기반으로 현대의 애플리케이션 아키텍처를 설계하고 구축하는 개발자가 어떤 것인지에 대한 맛보기 경험이었습니다. AWS에서의 개발자는 AWS CLI를 사용하여 프로그래밍 방식으로 리소스를 프로비저닝하고, AWS CloudFormation을 통해 인프라 정의를 재사용하고, AWS 개발자 도구를 사용하여 자동으로 코드 변경 사항을 빌드하고 배포하며, 어떤 서버도 프로비저닝하거나 관리할 필요가 없는 다양한 컴퓨팅 및 애플리케이션 서비스 기능을 활용할 수 있습니다.

AWS Modern Application Workshop을 즐겁게 완료하셨기를 바랍니다. 문제가 있거나 피드백/질문이 있으면 언제든 연락 주시기 바랍니다.

감사합니다.


## [AWS Developer Center](https://developer.aws)