import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Celo AI Agentic Backend API',
      version: '2.0.0',
      description: 'Production-ready agentic automation backend powered by Celo blockchain and LangChain agents',
      contact: {
        name: 'Celo AI Agents Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Agents', description: 'Agent management and querying' },
      { name: 'Deploy', description: 'Smart contract deployment' },
      { name: 'Transactions', description: 'Transaction sending and estimation' },
      { name: 'Limits', description: 'Spending limit management' },
      { name: 'Chains', description: 'Chain health monitoring' },
      { name: 'Workflows', description: 'Workflow orchestration' },
      { name: 'Health', description: 'System health checks' },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            errorCode: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['treasury', 'defi', 'nft', 'governance', 'donation'] },
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export function setupSwagger(app: Express): void {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

