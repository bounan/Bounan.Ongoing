interface AniManConfig {
  registerVideosLambdaName: string;
}

interface LoanApiConfig {
  functionArn: string;
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
  database: DatabaseConfig;
  processing: ProcessingConfig;
}
