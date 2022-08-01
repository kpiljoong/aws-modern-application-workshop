#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebApplicationStack } from "../lib/web-application-stack";

const app = new cdk.App();
new WebApplicationStack(app, "MythicalMysfits-Website");
