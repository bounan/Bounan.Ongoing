interface AniManConfig {
  registerVideosLambdaName: string;
}

interface LoanApiConfig {
  functionArn: string;
}

interface MalApiConfig {
  token: string;
}

interface DatabaseConfig {
  tableName: string;
}

interface ProcessingConfig {
  outdatedPeriodHours: number;
}

export interface Config {
  animan: AniManConfig;
  loanApiConfig: LoanApiConfig;
  malApiConfig: MalApiConfig;
  database: DatabaseConfig;
  processing: ProcessingConfig;
}
