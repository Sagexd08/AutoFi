
import 'dotenv/config';


const originalConsole = global.console;

beforeAll(() => {

  global.console = {

    ...originalConsole,

    log: jest.fn(),

    warn: jest.fn(),

    error: jest.fn(),

    info: jest.fn(),

    debug: jest.fn(),

  };

});

afterAll(() => {

  global.console = originalConsole;

});


jest.setTimeout(30000);


process.env.NODE_ENV = 'test';

process.env.GEMINI_API_KEY = 'test-key';

process.env.PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

process.env.RPC_URL = 'https://testnet.example.com';

process.env.NETWORK = 'testnet';

