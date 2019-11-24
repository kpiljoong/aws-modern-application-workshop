# 모듈 2: AWS Fargate로 서비스 생성

![Architecture](/images/module-2/architecture-module-2.png)

**완료에 필요한 시간:** 60분

---
**시간이 부족한 경우:** `module-2/cdk`에 있는 완전한 레퍼런스 AWS CDK 코드를 참고하세요

---

**사용된 서비스:**

* [AWS CloudFormation](https://aws.amazon.com/cloudformation/)
* [AWS Identity and Access Management (IAM)](https://aws.amazon.com/iam/)
* [Amazon Virtual Private Cloud (VPC)](https://aws.amazon.com/vpc/)
* [Amazon Elastic Load Balancing](https://aws.amazon.com/elasticloadbalancing/)
* [Amazon Elastic Container Service (ECS)](https://aws.amazon.com/ecs/)
* [AWS Fargate](https://aws.amazon.com/fargate/)
* [AWS Elastic Container Registry (ECR)](https://aws.amazon.com/ecr/)
* [AWS CodeCommit](https://aws.amazon.com/codecommit/)
* [AWS CodePipeline](https://aws.amazon.com/codepipeline/)
* [AWS CodeDeploy](https://aws.amazon.com/codedeploy/)
* [AWS CodeBuild](https://aws.amazon.com/codebuild/)

### 개요

모듈 2에서는 [AWS CDK](https://aws.amazon.com/cdk/)를 사용하여 [Amazon Elastic Container Service](https://aws.amazon.com/ecs/)의 [AWS Fargate](https://aws.amazon.com/fargate/)로 호스팅 되는 마이크로서비스를 생성하여 신비한 미스핏츠 웹사이트의 애플리케이션 백엔드를 구성합니다. AWS Fargate는 Amazon ECS의 배포 옵션으로서 클러스터 또는 서버 관리 없이 컨테이너를 배포할 수 있습니다. Python을 사용하여 Network Load Balancer 뒤에서 동작하는 Flask 앱의 도커 컨테이너를 생성하여 신비한 미스핏츠 백엔드를 구성합니다. 이를 통해 프론트엔드 웹사이트와 통합되는 마이크로서비스 백엔드를 형성할 것 입니다.

### AWS CDK를 사용하여 핵심 인프라 생성

서비스를 생성하기 전에 서비스가 사용할 코어 인프라 환경을 생성해야 합니다. 이는 [Amazon VPC](https://aws.amazon.com/vpc/)의 네트워킹 인프라와 ECS와 컨테이너가 AWS에서 필요한 권한을 정의하는 [AWS Identity and Access Management](https://aws.amazon.com/iam/) 역할을 포함합니다.

작성할 AWS CDK 애플리케이션은 아래 리소스들을 생성합니다:

* [**Amazon VPC**](https://aws.amazon.com/vpc/) - 10.0.0.0/16 프라이빗 IP 공간의 4개의 서브넷(2개의 퍼블릭, 2개의 프라이빗)과 필요로하는 라우트 테이블 구성을 포함하는 네트워크 환경. 이 네트워크의 서브넷은 별도의 AWS 가용 영역(AZ)에서 생성되어 AWS 리전의 여러 물리적 시설에 걸쳐 고가용성을 지원합니다. [여기](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)에서 고가용성을 달성하는데 가용 영역이 어떻게 도움이 되는지 자세히 알아볼 수 있습니다.
* [**2개의 NAT Gateway**](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) (여러 AZ에 걸쳐 각 퍼블릭 서브넷마다 1개씩) - 프라이빗 서브넷에 배포할 컨테이너가 인터넷에서 필요한 패키지 등을 다운로드할 수 있도록 합니다.
* [**DynamoDB VPC Endpoint**](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/vpc-endpoints-dynamodb.html) - 마이크로서비스 백엔드는 지속성을 위해 [Amazon DynamoDB](https://aws.amazon.com/dynamodb/)와 통합됩니다 (모듈 3에서 진행).
* [**Security Group**](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html) - 도커 컨테이너가 Network Load Balancer를 통해 인터넷으로부터 8080 포트로 트래픽을 수신할 수 있도록 합니다.
* [**IAM 역할**](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) - 인증 및 접근 관리 역할이 생성됩니다. 이 역할은 워크샵 전체에서 DynamoDB, S3 등과 같은 다른 AWS 서비스 접근에 사용됩니다.

`workshop/cdk` 디렉토리의 `lib` 폴더에서 `network-stack.ts` 이름의 새 파일을 생성합니다:

```sh
cd ~/environment/workshop/cdk
touch lib/network-stack.ts
```

생성한 파일에서 스켈레톤 CDK 스택 구조를 정의하고 `NetworkStack`으로 클래스명을 지정합니다:

```typescript
import cdk = require('@aws-cdk/core');

export class NetworkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id:string) {
    super(scope, id);

    // The code that defines your stack goes here
  }
}
```

그런 다음 `bin/cdk.ts`의 CDK 애플리케이션 정의에 NetworkStack을 추가합니다. 최종적으로 `bin/cdk.ts`는 다음처럼 보여야 합니다:

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";

const app = new cdk.App();
new WebApplicationStack(app, "MythicalMysfits-Website");
const networkStack = new NetworkStack(app, "MythicalMysfits-Network");
```

이제 AWS CDK를 사용하여 VPC를 정의합니다. 다시 한번 강조드리자면, AWS CDK는 높은 수준의 추상화를 제공하여 AWS 구성 요소 및 서비스를 쉽게 구현할 수 있도록 합니다. 한번 확인해보겠습니다.

먼저, Amazon EC2와 AWS IAM 용 CDK NPM 패키지를 설치합니다:

```sh
npm install --save-dev @aws-cdk/aws-ec2 @aws-cdk/aws-iam
```

`network-stack.ts` 파일에서 다음 VPC 컨스트럭츠를 정의합니다:

```typescript
import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import iam = require("@aws-cdk/aws-iam");

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id:string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "VPC");
  }
}
```

> **참고:** `ec2.Vpc`의 인스턴스를 다른 스택이 참조할 수 있도록 읽기 전용 속성을 할당합니다.

이 코드가 VPC를 정의하는데 필요한 전부입니다! `cdk synth` 명령을 실행하여 이 한 줄을 통해 생성되는 것을 확인해보겠습니다. 터미널 윈도우에서 다음 명령을 실행합니다:

```sh
cdk synth -o templates
```

이 명령은 NetworkStack의 AWS CloudFormation 템플릿을 생성하여 templates 이라는 폴더에 저장합니다. 생성된 파일을 열고 내용을 확인합니다.

단 한줄의 코드가 다음을 포함하는 엄청난 양의 AWS CloudFormation을 생성한 것을 확인할 수 있습니다:

* A VPC 컨스트럭츠
* 리전의 각 가용 영역의 퍼블릭, 프라이빗, 격리된 서브넷
* 각 서브넷의 라우팅 테이블
* 각 가용 영역의 NAT와 인터넷 게이트웨이

일부 속성을 재정의하여 생성중인 VPC를 사용자 정의 해보겠습니다. VPC 정의를 다음과 같이 변경합니다:

```typescript
this.vpc = new ec2.Vpc(this, "VPC", {
  natGateways: 2,
  maxAzs: 2
});
```

구축하려는 최대 NAT 게이트웨이 수와 배포하려는 최대 가용 영역의 수를 정의했습니다.

> **참고:** 위의 변경을 한 후 `network-stack.ts` 파일과 `workshop/source/module-2/cdk/lib` 폴더에 있는 파일을 비교하고, 동일한지 확인 하시기 바랍니다.

이제 다음 명령을 사용하여 VPC를 배포합니다:

```sh
cdk deploy MythicalMysfits-Network
```

## Module 2a: AWS Fargate로 서비스 배포

### Flask 서비스 컨테이너 생성

#### 도커 이미지 생성

다음으로 신비한 미스핏츠 백엔드를 Flask로 작성된 마이크로서비스 API로 실행하는데 필요한 모든 코드 및 구성을 포함하는 도커 컨테이너 이미지를 만들겠습니다. Cloud9 내에서 도커 컨테이너 이미지를 빌드한 다음 Amazon Elastic Container Registry로 푸시합니다. 이를 통해 Fargate로 서비스를 만들 때 컨테이너 이미지를 가져올 수 있습니다.

서비스 백엔드를 실행하는데 필요한 모든 코드는 Cloud9 IDE에 복제한 리포지토리의 디렉토리 `workshop/source/module-2/app/`에 저장되어있습니다. Flask를 사용하여 서비스 API를 생성하는 Python 코드를 검토하려면 `workshop/source/module-2/app/service/mythicalMysfitsService.py` 파일을 확인하세요.

도커는 생성한 Cloud9 IDE에 이미 설치되어 있습니다. 그래서 도커 이미지를 로컬에서 빌드하기위해 Cloud9 터미널에 다음 명령만 실행하면 됩니다:

```sh
cd ~/environment/workshop/
mkdir app && cd app
```

애플리케이션 코드를 복사합니다:

```sh
cp -R ~/environment/workshop/source/module-2/app ~/environment/workshop
```

준비되어있는 Dockerfile로 Docker 이미지를 생성합니다:

* `~/environment/workshop/source/module-2/app`로 이동합니다.

```
cd ~/environment/workshop/source/module-2/app
```

```sh
docker build . -t $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/mythicalmysfits/service:latest
```

도커가 애플리케이션이 필요로하는 모든 필수 종속성 패키지를 다운로드하여 설치하고 빌드 된 이미지의 태그를 출력합니다. **나중에 참조할 수 있도록 태그를 복사합니다. 밑의 예제에서의 태그는 다음과 같습니다: 111111111111.dkr.ecr.us-east-1.amazonaws.com/mythicalmysfits/service:latest**

```
Successfully built 8bxxxxxxxxab
Successfully tagged 111111111111.dkr.ecr.us-east-1.amazonaws.com/mythicalmysfits/service:latest
```

#### 로컬에서 서비스 테스트

Cloud9 내에서 이미지를 테스트하여 예상대로 작동하는지 테스트해보겠습니다. 아래 명령을 실행하여 컨테이너를 로컬에 배포합니다 (정확히는 AWS내의 Cloud9 IDE에서 입니다):

```
docker run -p 8080:8080 $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/mythicalmysfits/service:latest
```

컨테이너가 로컬에서 작동중인걸 확인할 수 있습니다:

```
 * Running on http://0.0.0.0:8080/ (Press CTRL+C to quit)
```

로컬에서 서비스를 테스트해보기 위해 IDE 인스턴스에서 실행중인 애플리케이션을 미리 볼 수 있는 Cloud9 IDE에 내장된 웹브라우저를 열겠습니다. 미리보기 웹 브라우저를 열기위해 Cloud9의 메뉴바에서 **Preview > Preview Running Application**를 선택합니다:

![preview-menu](/images/module-2/preview-menu.png)

IDE에서 다른 패널이 열리고 웹 브라우저를 볼 수 있을 것입니다. 미리보기 웹 브라우저의 주소 표시 줄의 URI 끝에 /mysfits 를 추가하고 엔터를 누릅니다:

![preview-menu](/images/module-2/address-bar.png)

문제없이 동작하면 `~/environment/workshop/source/module-2/app/service/mysfits-response.json`에 저장된 JSON 문서를 반환하는 응답을 볼 수 있습니다.

서비스 테스트가 완료되면 PC 또는 Mac에서 CTRL-c를 눌러 서비스를 중지할 수 있습니다.

#### Amazon Elastic Container Registry (ECR) 리포지토리 생성

서비스를 로컬에서 성공적으로 테스트하였다면 [Amazon Elastic Container Registry](https://aws.amazon.com/ecr/) (Amazon ECR)에 컨테이너 이미지 리포지토리를 생성하고 이미지를 푸시할 준비가 되었습니다. CDK를 사용하여 레지스트리를 만들기 위해 `lib` 폴더에 `ecr-stack.ts` 이라는 새 파일을 생성합니다:

```sh
cd ~/environment/workshop/cdk
touch lib/ecr-stack.ts
```

이전과 마찬가지로 CDK 스택의 스켈레톤 구조를 정의합니다:

```typescript
import cdk = require('@aws-cdk/core');

export class EcrStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // The code that defines your stack goes here
  }
}
```

그런 다음 이전에 한 것처럼 ECRStack을 `bin/cdk.ts`의 CDK 애플리케이션 정의에 추가합니다. 완료되면 `bin/cdk.ts`는 다음처럼 보여야 합니다:

```typescript
#!/usr/bin/env node

import cdk = require('@aws-cdk/core');
import "source-map-support/register";
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";

const app = new cdk.App();
new WebApplicationStack(app, "MythicalMysfits-Website");
const networkStack = new NetworkStack(app, "MythicalMysfits-Network");
const ecrStack = new EcrStack(app, "MythicalMysfits-ECR");
```

다음으로 Amazon ECR CDK NPM 패키지를 설치해야합니다:

```sh
npm install --save-dev @aws-cdk/aws-ecr
```

그런 다음 다음과 같이 ECR 리포지토리 정의를 EcrStack에 추가합니다:

다음 import 구문을 첫줄의 `import cdk` 구문 다음에 추가합니다:

```typescript
import ecr = require("@aws-cdk/aws-ecr");
```

EcrStack을 다음처럼 작성합니다:

```typescript
export class EcrStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);
    this.ecrRepository = new ecr.Repository(this, "Repository", {
      repositoryName: "mythicalmysfits/service"
    });
  }
}
```

> **참고:** `ecr.Repository`의 인스턴스를 다른 스택에서 참조할 수 있도록 읽기전용 속성을 할당합니다.

이제 다음 명령어로 ECR 스택을 배포합니다:

```sh
cdk deploy MythicalMysfits-ECR
```

브라우저에서 ECR 대시보드로 이동하여 방금 생성한 ECR 리포지토리가 목록에있는지 확인합니다.

#### 도커 이미지를 Amazon ECR에 푸시

컨테이너 이미지를 새 리포지토리에 푸시하기위해서는 도커 클라이언트를 위한 인증 자격증명을 획득해야합니다. 아래 명령을 실행하면 도커 클라이언트를 위한 자격증명을 획득하는 로그인 명령을 보여주며, 그 명령을 자동으로 실행해줍니다 (명령은 $를 포함합니다). 문제 없이 명령이 수행되면 'Login Succeeded'를 볼 수 있습니다:

```
$(aws ecr get-login --no-include-email)
```

그런 다음, 위에서 복사한 태그를 사용하여 ECR 리포지토리에 이미지를 푸시합니다. 아래 명령을 사용하면 도커는 생성한 이미지와 함께 연관된 모든 이미지를 Amazon ECR에 푸시할 것 입니다:

```
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$(aws configure get region).amazonaws.com/mythicalmysfits/service:latest
```

ECR 리포지토리에 저장된 직접 푸시한 이미지를 보기 위해 아래 명령을 실행합니다:

```
aws ecr describe-images --repository-name mythicalmysfits/service
```

### AWS Fargate와 Amazon ECS Service 생성

이제 ECR에 이미지가 저장되었으며, AWS Fargate를 사용하여 Amazon ECS에서 호스팅되는 서비스에 배포할 수 있습니다. 이전 모듈의 일부로 Cloud9의 터미널을 통해 로컬에서 테스트한 동일한 서비스가 클라우드로 배포되고 Network Load Balancer를 통해 퍼블릭하게 접근할 수 있도록 해보겠습니다.

먼저 **Amazon Elastic Container Service (ECS)**에서 **Cluster**를 생성할 것 입니다. **Cluster**는 서비스 컨테이너가 배포될 "서버" 클러스터를 나타냅니다. 서버가 "인용문" 내에 있는 이유는 **AWS Fargate**를 사용하기 때문입니다. Fargate를 사용하면 서버를 실제로 프로비저닝하거나 관리할 필요 없이 컨테이너를 클러스터에 배포할 수 있습니다.

이제 ECS 인스턴스를 정의합니다. 정의하기 이전에 아래 명령으로 AWS ECS CDK NPM 패키지를 설치합니다:

```sh
npm install --save-dev @aws-cdk/aws-ecs @aws-cdk/aws-ecs-patterns
```

이전과 마찬가지로 `lib` 폴더에 `ecs-stack.ts`이라는 파일을 생성합니다:

```sh
touch lib/ecs-stack.ts
```

CDK 스택의 스켈레톤 구조를 정의합니다:

```typescript
import cdk = require('@aws-cdk/core');

export class EcsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // The code that defines your stack goes here
  }
}
```

우리가 생성중인 `EcsStack` 스택은 이전에 생성한 두개의 스택과 종속성을 가집니다. 종속성과 속성을 스택으로 가져오는 방법으로 속성 인터페이스 사용이 권장됩니다. 속성 인터페이스를 정의해보겠습니다.

`EcsStack` 정의 위에, 다음 모듈을 import 합니다:

```typescript
import ec2 = require('@aws-cdk/aws-ec2');
import ecr = require('@aws-cdk/aws-ecr');
```

그리고 EcsStack 정의 위에 다음 속성 객체를 정의합니다:

```typescript
interface EcsStackProps extends cdk.StackProps {
    vpc: ec2.Vpc,
    ecrRepository: ecr.Repository
}
```

정의한 속성 객체를 EcsStack의 생성자에서 인자로 받도록 합니다:

```typescript
  constructor(scope: cdk.Construct, id: string, props: EcsStackProps) {
```

EcsStack에서 필요한 나머지 AWS CDK 모듈을 import 합니다:

```typescript
import ecs = require("@aws-cdk/aws-ecs");
import ecsPatterns = require("@aws-cdk/aws-ecs-patterns");
import iam = require("@aws-cdk/aws-iam");
```

이후 워크샵에서 생성할 다른 스택에서 사용될 수 있도록 ecsCluster와 ecsService를 노출(expose)해야 합니다. 이를 위해 EcsStack 상단에 두개의 속성을 정의합니다:

```typescript
export class EcsStack extends cdk.Stack {
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecsService: ecsPatterns.NetworkLoadBalancedFargateService;

  constructor(scope: cdk.Construct, id: string, props: EcsStackProps) {
    super(scope, id);
```

ECS Cluster 객체를 정의합니다:

```typescript
this.ecsCluster = new ecs.Cluster(this, "Cluster", {
  clusterName: "MythicalMysfits-Cluster",
  vpc: props.vpc
});
this.ecsCluster.connections.allowFromAnyIpv4(ec2.Port.tcp(8080));
```

`EcsStackProps` 속성에 정의된 VPC (`props.vpc`)를 어떻게 참조하는지 살펴 볼 필요가 있습니다. [AWS CDK](https://aws.amazon.com/cdk/)는 CloudFormation 객체간에 자동으로 참조를 생성합니다. 또 생성된 `ecs.Cluster`의 인스턴스를 로컬 속성에 할당하여 해당 스택은 물론 다른 스택에서 참조될 수 있도록 하는 부분도 참고하시기 바랍니다:

```typescript
this.ecsService = new ecsPatterns.NetworkLoadBalancedFargateService(this, "Service", {
  cluster: this.ecsCluster,
  desiredCount: 1,
  publicLoadBalancer: true,
  taskImageOptions: {
    enableLogging: true,
    containerName: "MythicalMysfits-Service",
    containerPort: 8080,
    image: ecs.ContainerImage.fromEcrRepository(props.ecrRepository),
  }
});
this.ecsService.service.connections.allowFrom(ec2.Peer.ipv4(props.vpc.vpcCidrBlock),ec2.Port.tcp(8080));
```

컨테이너 포트의 정의와 AWS CDK에 의해 생성된 EC2 SecurityGroups 규칙을 수정하여 우리가 생성한 VPC의 CIDR 블록에서의 요청만 허가하도록 제한하는 부분을 확인하시기 바랍니다.

다음으로 추가 IAM 정책 Statements를 실행(Execution)과 작업 역할(Task Roles)에 추가합니다:

```typescript
const taskDefinitionPolicy = new iam.PolicyStatement();
taskDefinitionPolicy.addActions(
  // Rules which allow ECS to attach network interfaces to instances
  // on your behalf in order for awsvpc networking mode to work right
  "ec2:AttachNetworkInterface",
  "ec2:CreateNetworkInterface",
  "ec2:CreateNetworkInterfacePermission",
  "ec2:DeleteNetworkInterface",
  "ec2:DeleteNetworkInterfacePermission",
  "ec2:Describe*",
  "ec2:DetachNetworkInterface",

  // Rules which allow ECS to update load balancers on your behalf
  //  with the information sabout how to send traffic to your containers
  "elasticloadbalancing:DeregisterInstancesFromLoadBalancer",
  "elasticloadbalancing:DeregisterTargets",
  "elasticloadbalancing:Describe*",
  "elasticloadbalancing:RegisterInstancesWithLoadBalancer",
  "elasticloadbalancing:RegisterTargets",

  //  Rules which allow ECS to run tasks that have IAM roles assigned to them.
  "iam:PassRole",

  //  Rules that let ECS create and push logs to CloudWatch.
  "logs:DescribeLogStreams",
  "logs:CreateLogGroup");
taskDefinitionPolicy.addAllResources();

this.ecsService.service.taskDefinition.addToExecutionRolePolicy(
  taskDefinitionPolicy
);

const taskRolePolicy =  new iam.PolicyStatement();
taskRolePolicy.addActions(
  // Allow the ECS Tasks to download images from ECR
  "ecr:GetAuthorizationToken",
  "ecr:BatchCheckLayerAvailability",
  "ecr:GetDownloadUrlForLayer",
  "ecr:BatchGetImage",
  // Allow the ECS tasks to upload logs to CloudWatch
  "logs:CreateLogStream",
  "logs:CreateLogGroup",
  "logs:PutLogEvents"
);
taskRolePolicy.addAllResources();

this.ecsService.service.taskDefinition.addToTaskRolePolicy(
  taskRolePolicy
);
```

그런 후 이전과 마찬가지로 EcsStack을 `bin/cdk.ts`의 CDK 애플리케이션 정의에 추가합니다. 완료 후 `bin/cdk.ts`는 다음처럼 보여야 합니다:

```typescript
#!/usr/bin/env node

import cdk = require('@aws-cdk/core');
import "source-map-support/register";
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";

const app = new cdk.App();
new WebApplicationStack(app, "MythicalMysfits-Website");
const networkStack = new NetworkStack(app, "MythicalMysfits-Network");
const ecrStack = new EcrStack(app, "MythicalMysfits-ECR");
const ecsStack = new EcsStack(app, "MythicalMysfits-ECS", {
    vpc: networkStack.vpc,
    ecrRepository: ecrStack.ecrRepository
});
```

#### ECS 용 Server Linked 역할 생성

이전에 이미 ECS를 사용한 경우 이 단계를 건너 뛰고 다음 단계로 넘어갈 수 있습니다. 이전에 ECS를 사용한 적이 없다면 IAM에서 ECS 서비스 자체에 계정 내 ECS API 요청을 할 수 있는 권한을 부여하는 서비스 연결 역할을 생성해야합니다. 이게 필요한 이유는 ECS에서 서비스를 생성할 때 서비스가 도커 이미지를 가져오고, 새 작업을 생성하는 등의 작업을 수행하기 위해 계정 내에서 API를 호출하기 때문입니다.

이 역할을 만들지 않으면, ECS 서비스에 필요한 작업을 수행할 수 있는 권한이 부여되지 않습니다. 역할을 작성하려면 터미널에서 다음 명령을 실행합니다:

```sh
aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
```

위의 기존 역할에 대한 오류가 반환되면 이전에 계정에서 역할이 자동으로 생성되었음을 나타내므로 무시해도됩니다.

이제 ECS 스택을 배포합니다:

```sh
cdk deploy MythicalMysfits-ECS
```

`Do you wish to deploy these changes (y/n)?`와 같은 메시지가 표시되면 `y`를 입력합니다.

서비스가 생성된 후 ECS는 ECR로 푸시한 컨테이너를 실행하는 새 작업을 프로비저닝하고 생성된 NLB에 등록합니다.

#### 서비스 테스트

사용하는 브라우저를 통해 이전 작업 완료 후 출력되는 NLB DNS에 접속하여 작동하는지 확인합니다. CURL 명령을 사용하여 mysfits 리소스에 요청을 보내봅니다:

```sh
curl http://<replace-with-your-nlb-address>/mysfits
```

이전에 도커 컨테이너를 로컬에서 테스트할 때 본 JSON 응답과 동일한 응답을 볼 수 있으며, 이를통해 Python 웹 API가 AWS Fargate에서 정상적으로 동작하고 있다는 걸 확인할 수 있습니다.

> **참고:** 최초 접속 시 시간이 소요될 수 있습니다.

> **참고:** Network Load Balancer는 SSL/TLS 인증서가 설치되어 있지 않으므로 HTTP (http://) 요청만 지원합니다. 이 워크샵에서는 http:// 으로만 요청을 보내야 합니다. https:// 요청은 정상적으로 동작하지 않을 것입니다.

### 신비한 미스핏츠가 NLB를 호출하도록 변경

#### API 엔드포인트 수정

다음으로, 웹사이트가 이전에 S3에 업로드한 하드 코딩된 데이터를 사용하는 대신 새로운 API 백엔드와 통합해야 합니다. `workshop/source/module-2/web` 디렉토리에서 웹 애플리케이션 코드를 복사합니다:

```sh
cp -r ~/environment/workshop/source/module-2/web/* ~/environment/workshop/web
```

API 호출에 동일한 NLB URL을 사용하기 위해 `workshop/web/index.html` 파일을 업데이트 합니다 (/mysfits 경로를 포함하지 마세요). Cloud9에서 파일을 열고 아래 ' ' 안에 하이라이트된 부분에 NLB URL을 입력합니다:

![before replace](/images/module-2/before-replace.png)

복사한 NLB URL을 붙여넣으면 아래와 같이 됩니다:

![after replace](/images/module-2/after-replace.png)

#### 신비한 미스핏츠 웹사이트 업데이트
S3에서 호스팅되는 웹사이트를 업데이트하기 위해 `MythicalMysfits-Website` 스택을 배포합니다:

```sh
cdk deploy MythicalMysfits-Website
```

업데이트된 신비한 미스핏츠 웹사이트를 확인하기 위해 모듈 1 마지막에 출력하게끔 한 CloudFront URL을 사용하여 웹사이트에 접속합니다 (HTTP으로 접속하여야 합니다). AWS Fargate에 배포된 도커 컨테이너에서 동작하는 Flask API로부터 JSON 데이터를 받습니다.


## 모듈 2b: AWS Code 서비스를 사용한 배포 자동화

![Architecture](/images/module-2/architecture-module-2b.png)

이제 서비스가 시작되어 동작중입니다. 서비스를 운영하며 Flask 서비스의 코드를 변경해야하는 일은 자주 발생하는 작업입니다. 서비스에 새로운 기능을 배포할 때마다 앞선 모든 과정을 반복하는건 개발 속도를 느리게 만드는 병목이 될 수 있습니다. 이를 해결하기 위해 지속적 통합 및 지속적 전달, 또는 CI/CD라 불리우는 기술이 등장합니다!

이번 섹션에서는 코드베이스에 대한 모든 코드 변경 사항을 마지막 섹션에서 만든 서비스에 자동으로 전달하는 완전 관리되는 CI/CD 스택을 만들어봅니다.

### 백엔드 서비스를 위한 CodeCommit 리포지토리 생성

먼저 AWS CodeCommit CDK NPM 패키지를 설치합니다:

```sh
cd ~/environment/workshop/cdk
npm install --save-dev @aws-cdk/aws-codecommit
```

이전처럼 `lib` 폴더에 `cicd-stack.ts` 파일을 생성합니다:

```sh
touch lib/cicd-stack.ts
```

CDK 스택의 스켈레톤 구조를 정의합니다:

```typescript
import cdk = require('@aws-cdk/core');

export class CiCdStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // The code that defines your stack goes here
  }
}
```

현재 만들고자하는 스택은 이전에 생성한 2개의 스택을 활용합니다. 이런 종속성과 속성을 가져오는 방법으로 속성 구문을 사용하는게 좋습니다. 정의해보겠습니다.

CiCdStack정의 위에 다음 모듈을 import 합니다:

```typescript
import ecr = require("@aws-cdk/aws-ecr");
import ecs = require("@aws-cdk/aws-ecs");
```

다음 속성 객체를 정의합니다:

```typescript
interface CiCdStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  ecsService: ecs.FargateService;
}
```

CiCdStack 생성자를 변경하여 정의한 속성 객체를 입력 받도록 합니다:

```typescript
  constructor(scope: cdk.Construct, id: string, props: CiCdStackProps) {
```

`bin/cdk.ts` 파일에 레퍼런스를 업데이트합니다. 다음 코드를 작성합니다:

```typescript
#!/usr/bin/env node

import cdk = require("@aws-cdk/core");
import 'source-map-support/register';
import { WebApplicationStack } from "../lib/web-application-stack";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";
import { CiCdStack } from "../lib/cicd-stack";

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
```

이제 `cicd-stack.ts` 파일에 import 문을 추가합니다:

```typescript
import codecommit = require('@aws-cdk/aws-codecommit');
```

AWS CodeCommit 리포지토리를 위한 정의를 추가해보겠습니다. AWS CDK는 CloudFormation 템플릿의 구현을 단순화하고 생성하려는 리소스를 세부적으로 제어할 수 있는 고수준 추상화의 종합적인 묶음들로 구성됩니다.

웹사이트를 위한 CodeCommit 리포지토리를 정의해보겠습니다. `cicd-stack.ts` 파일에 아래 코드를 작성합니다:

```typescript
const backendRepository = new codecommit.Repository(this, "BackendRepository", {
  repositoryName: "MythicalMysfits-BackendRepository"
});
```

생성된 CloudFormation 템플릿으로 `cdk.CfnOutput` 컨스트럭츠를 정의하는 사용자 지정 출력(Output) 속성을 정의하여 생성된 CodeCommit 리포지토리의 클론 URL을 제공하도록 할 수 있습니다. 아래와 같이 리포지토리의 HTTP와 SSH 클론 URL을 `cdk.CfnOutput`로 정의합니다. 완료 후 파일은 다음과 같이 보일 것입니다:

```typescript
import cdk = require("@aws-cdk/core");
import ecr = require("@aws-cdk/aws-ecr");
import ecs = require("@aws-cdk/aws-ecs");
import codecommit = require("@aws-cdk/aws-codecommit");

interface CiCdStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  ecsService: ecs.FargateService;
}
export class CiCdStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: CiCdStackProps) {
    super(scope, id);

    const backendRepository = new codecommit.Repository(this, "BackendRepository", {
      repositoryName: "MythicalMysfits-BackendRepository"
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
```

### CI/CD 파이프라인 생성

AWS CodeBuild와 AWS CodePipeline CDK NPM 패키지를 설치하기 위해 `workshop/cdk` 디렉토리에서 다음 명령을 실행합니다:

```sh
npm install --save-dev @aws-cdk/aws-codebuild  @aws-cdk/aws-codepipeline  @aws-cdk/aws-codepipeline-actions
```

`cicd-stack.ts` 파일에 필요한 라이브러리를 import 하는 구문을 추가합니다:

```typescript
import codebuild = require('@aws-cdk/aws-codebuild');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import actions = require('@aws-cdk/aws-codepipeline-actions');
import iam = require('@aws-cdk/aws-iam');
```

`CiCdStack` 파일에 CodeBuild 프로젝트를 정의하여 Python Flask 웹앱을 빌드하는 다음 코드를 추가합니다:

```typescript
const codebuildProject = new codebuild.PipelineProject(this, "BuildProject", {
  projectName: "MythicalMysfitsServiceCodeBuildProject",
  environment: {
    computeType: codebuild.ComputeType.SMALL,
    buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_PYTHON_3_5_2,
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
```

CodeCommit 리포지토리를 쿼리할 수 있는 권한을 CodeBuild 프로젝트에 부여합니다:

```typescript
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
```

CodeBuild 프로젝트에 ECR 리포지토리에 이미지를 푸시하고, 가져오는 권한을 추가합니다:

```typescript
props.ecrRepository.grantPullPush(codebuildProject.grantPrincipal);
```

이제 웹 앱 소스를 어디에서 가져올지 지정하는 CodePipeline Source 액션을 정의합니다. 여기서는 CodeCommit 리포지토리를 사용합니다:

```typescript
const sourceOutput = new codepipeline.Artifact();
const sourceAction = new actions.CodeCommitSourceAction({
  actionName: "CodeCommit-Source",
  branch: "master",
  trigger: actions.CodeCommitTrigger.EVENTS,
  repository: backendRepository,
  output: sourceOutput
});
```

앞에서 Flask 웹 앱의 도커 이미지를 빌드하기 위해 생성한 CodeBuild 프로젝트를 사용하는 CodePipeline Build 액션을 정의합니다:

```typescript
const buildOutput = new codepipeline.Artifact();
const buildAction = new actions.CodeBuildAction({
  actionName: "Build",
  input: sourceOutput,
  outputs: [
    buildOutput
  ],
  project: codebuildProject
});
```

CodePipeline에게 BuildAction의 결과를 어떻게 배포할지 제어할 ECS 배포 액션을 정의합니다:

```typescript
const deployAction = new actions.EcsDeployAction({
  actionName: "DeployAction",
  service: props.ecsService,
  input: buildOutput
});
```

마지막으로 CodePipeline 파이프라인과 모든 스테이지/액션을 정의합니다:

```typescript
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
```

`cicd-stack.ts` 파일은 다음과 같이 보일 것입니다:

```typescript
import cdk = require("@aws-cdk/core");
import ecr = require("@aws-cdk/aws-ecr");
import ecs = require("@aws-cdk/aws-ecs");
import codecommit = require("@aws-cdk/aws-codecommit");
import codebuild = require("@aws-cdk/aws-codebuild");
import codepipeline = require("@aws-cdk/aws-codepipeline");
import actions = require("@aws-cdk/aws-codepipeline-actions");
import iam = require("@aws-cdk/aws-iam");

interface CiCdStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  ecsService: ecs.FargateService;
}
export class CiCdStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: CiCdStackProps) {
    super(scope, id);

    const backendRepository = new codecommit.Repository(this, "BackendRepository", {
      repositoryName: "MythicalMysfits-BackendRepository"
    });

    const codebuildProject = new codebuild.PipelineProject(this, "BuildProject", {
      projectName: "MythicalMysfitsServiceCodeBuildProject",
      environment: {
        computeType: codebuild.ComputeType.SMALL,
        buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_PYTHON_3_5_2,
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
      trigger: actions.CodeCommitTrigger.POLL,
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
      input: buildOutput
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
```

### Pipeline 배포

CICD 스택을 배포합니다:

```sh
cdk deploy MythicalMysfits-CICD
```

### CI/CD 파이프라인 테스트

#### AWS CodeCommit과 Git 사용

파이프라인을 테스트하기 위해 Cloud9 IDE에서 git을 설정하고 CodeCommit 리포지토리와 통합해야합니다.

AWS CodeCommit은 통합을 쉽게하기 위해 git 관련 자격 증명 헬퍼를 제공합니다. 터미널에서 다음 명령을 순서대로 실행하여 git을 설정합니다 (명령은 별다른 결과를 출력하지 않습니다):

```sh
git config --global user.name "REPLACE_ME_WITH_YOUR_NAME"
git config --global user.email REPLACE_ME_WITH_YOUR_EMAIL@example.com
git config --global credential.helper '!aws codecommit credential-helper $@'
git config --global credential.UseHttpPath true
```

IDE의 터미널에서 environment 디렉토리로 이동합니다:

```sh
cd ~/environment/workshop
rm -rf app
```

이제 다음 터미널 명령을 사용하여 리포지토리를 클론합니다:

```sh
git clone https://git-codecommit.$(aws configure get region).amazonaws.com/v1/repos/MythicalMysfits-BackendRepository app
```

클론을 하면 리포지토리가 비어있음을 확인할 수 있습니다. 다음 명령으로 애플리케이션 파일을 리포지토리 디렉토리에 복사하겠습니다:

```sh
cp -r ~/environment/workshop/source/module-2/app/* ~/environment/workshop/app
```

#### 코드 변경 푸시

이전 섹션에서 Fargate 서비스를 생성하는데 사용한 완성된 코드는 AWS CodeCommit에서 클론한 로컬 리포지토리에 저장됩니다. Flask 서비스를 변경한 후 변경 사항을 커밋하여 우리가 구성한 CI/CD 파이프라인이 잘 동작하는지 보겠습니다. 

_다음 작업을 수행합니다_

1. Cloud9에서 `~/environment/workshop/app/service/mysfits-response.json` 파일을 오픈합니다.
2. 미스핏츠 중 하나의 나이(age)를 바꾼 후 파일을 저장합니다.

파일을 저장한 후 리포지토리 디렉토리로 이동합니다:

```sh
cd ~/environment/workshop/app/
```

그리고나서 다음 git 명령으로 코드 변경을 푸시합니다:

```sh
git add .
git commit -m "I changed the age of one of the mysfits."
git push
```

변경 사항을 리포지토리에 푸시한 후 AWS 콘솔의 CodePipeline 서비스 페이지에서 CI/CD 파이프라인을 통해 변경이 어떻게 진행되는지 확인할 수 있습니다. 코드 변경을 커밋한 후 변경 사항이 Fargate에서 실행되는 라이브 서비스로의 배포는 약 5-10분이내에 완료될 것 입니다. 이 시간 동안 AWS CodePipeline은 CodeCommit 리포지토리에 변경된 코드가 체크인 되면 파이프라인을 실행하고, CodeBuild 프로젝트가 새로운 빌드를 시작하도록 하며, CodeBuild가 ECR에 푸시한 도커 이미지를 가져와 자동화된 ECS [Update Service](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/update-service.html) 액션을 수행하여 실행중인 컨테이너에 연결된 커넥션을 드레이닝하고, 새 이미지로 교체합니다. 변경 사항이 잘 적용되었는지 확인하기 위해 브라우저에서 신비한 미스핏츠 웹사이트에 다시 접속해봅니다.

> **참고:** 미스핏츠 이미지를 볼 수 없다면, [브라우저 설정에서 *mixed content*를 허용해주세요](https://docs.adobe.com/content/help/en/target/using/experiences/vec/troubleshoot-composer/mixed-content.html).

CodePipeline 콘솔에서 코드 변경 진행 사항을 확인할 수 있습니다 (별다른 행동없이 콘솔에서 진행 사항을 확인할 수 있습니다):
[AWS CodePipeline](https://console.aws.amazon.com/codepipeline/home)

이것으로 모듈 2를 마치겠습니다.

[모듈 3 진행](/module-3)


## [AWS Developer Center](https://developer.aws)
