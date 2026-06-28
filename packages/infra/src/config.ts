import { ExportNames } from '../../../third-party/common/ts/cdk/export-names';
import { getCfnValue } from '../../../third-party/common/ts/cdk/helpers';
import configFile from './configuration.json';

export interface Config {
  alertEmail: string;
  loanApiFunctionArn: string;
  registerVideosFunctionName: string;
  videoRegisteredTopicArn: string;
}

export const getConfig = (prefix: string): Config => ({
  alertEmail: getCfnValue('alertEmail', prefix, ExportNames.AlertEmail, configFile),
  loanApiFunctionArn: getCfnValue('loanApiFunctionArn', prefix, ExportNames.LoanApiFunctionArn, configFile),
  registerVideosFunctionName: getCfnValue('registerVideosFunctionName', prefix, ExportNames.RegisterVideosFunctionName, configFile),
  videoRegisteredTopicArn: getCfnValue('videoRegisteredTopicArn', prefix, ExportNames.VideoRegisteredSnsTopicArn, configFile),
});
