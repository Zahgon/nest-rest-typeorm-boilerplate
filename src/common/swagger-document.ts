/**
 * The OpenAPI document served by this API.
 *
 * Mirrors the document the decorator-driven generator used to emit, so the
 * published contract at the docs endpoints is unchanged by the migration.
 */
export const swaggerDocument = {
  openapi: '3.0.0',
  paths: {
    '/api': {
      get: {
        operationId: 'AppController_getStartingMessage',
        parameters: [],
        responses: {
          '200': {
            description: 'Root Request Completed',
          },
          '400': {
            description: 'Root Request Failed',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        tags: ['App'],
      },
    },
    '/api/v1/auth/login': {
      post: {
        operationId: 'AuthController_login',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginDto',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Login Completed',
          },
          '400': {
            description: 'Bad Request',
          },
          '401': {
            description: 'Unauthorized',
          },
        },
        tags: ['authentication'],
      },
    },
    '/api/v1/auth/register': {
      post: {
        operationId: 'AuthController_register',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterDto',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Registration Completed',
          },
          '400': {
            description: 'Bad Request',
          },
          '401': {
            description: 'Unauthorized',
          },
        },
        tags: ['authentication'],
      },
    },
    '/api/v1/users/user': {
      get: {
        operationId: 'UsersController_getUser',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        tags: ['users'],
      },
    },
    '/api/v1/users/{username}': {
      get: {
        operationId: 'UsersController_getUserByUsername',
        parameters: [
          {
            name: 'username',
            required: true,
            in: 'path',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Fetch User Request Received',
          },
          '400': {
            description: 'Fetch User Request Failed',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        tags: ['users'],
      },
      delete: {
        operationId: 'UsersController_deleteUserByUsername',
        parameters: [
          {
            name: 'username',
            required: true,
            in: 'path',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Delete User Request Received',
          },
          '400': {
            description: 'Delete User Request Failed',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        tags: ['users'],
      },
    },
    '/api/v1/users': {
      patch: {
        operationId: 'UsersController_patchUser',
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PatchUserDto',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Patch User Request Received',
          },
          '400': {
            description: 'Patch User Request Failed',
          },
        },
        security: [
          {
            bearer: [],
          },
        ],
        tags: ['users'],
      },
    },
    '/api/v1/mcp/inventory': {
      get: {
        operationId: 'McpController_inventory',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
    },
    '/api/v1/mcp/invoke': {
      post: {
        operationId: 'McpController_invoke',
        parameters: [],
        responses: {
          '201': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
    },
    '/api/v1/mcp/resource': {
      get: {
        operationId: 'McpController_resource',
        parameters: [
          {
            name: 'serverId',
            required: true,
            in: 'query',
            schema: {
              type: 'string',
            },
          },
          {
            name: 'uri',
            required: true,
            in: 'query',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
    },
    '/api/v1/mcp/chat': {
      post: {
        operationId: 'McpController_chat',
        parameters: [],
        responses: {
          '201': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
    },
    '/api/v1/mcp/transport': {
      get: {
        operationId: 'McpController_transport_get',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
      post: {
        operationId: 'McpController_transport_post',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
      put: {
        operationId: 'McpController_transport_put',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
      delete: {
        operationId: 'McpController_transport_delete',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
      patch: {
        operationId: 'McpController_transport_patch',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
      options: {
        operationId: 'McpController_transport_options',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
      head: {
        operationId: 'McpController_transport_head',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
      search: {
        operationId: 'McpController_transport_search',
        parameters: [],
        responses: {
          '200': {
            description: '',
          },
        },
        tags: ['mcp'],
      },
    },
  },
  info: {
    title: 'API',
    description: 'API Description',
    version: '1.0',
    contact: {},
  },
  tags: [],
  servers: [
    {
      url: '/api',
    },
  ],
  components: {
    securitySchemes: {
      bearer: {
        scheme: 'bearer',
        bearerFormat: 'JWT',
        type: 'http',
      },
    },
    schemas: {
      LoginDto: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
        },
        required: ['username', 'password'],
      },
      RegisterDto: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
          },
          username: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
        },
        required: ['email', 'username', 'name', 'password'],
      },
      PatchUserDto: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
          },
          username: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
        },
        required: ['email', 'username', 'name', 'password'],
      },
    },
  },
};
