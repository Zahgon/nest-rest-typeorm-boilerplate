import { ConfigService } from '../common/config.service';
import { UsersService } from '../users/users.service';
import { McpController } from './mcp.controller';
import { McpClientService } from './mcp-client.service';
import { McpGatewayService } from './mcp-gateway.service';
import { McpServerService } from './mcp-server.service';

/**
 * Owns the Model Context Protocol surface: the local server that exposes this
 * API's data as tools and resources, the client that mirrors any configured
 * remote servers, and the gateway that presents both as one inventory.
 *
 * Connecting is deferred to {@link init} so the object graph can be built --
 * and its routes registered -- without reaching out over the network.
 */
export class McpModule {
  readonly server: McpServerService;
  readonly client: McpClientService;
  readonly gateway: McpGatewayService;
  readonly controller: McpController;

  constructor(config: ConfigService, usersService: UsersService) {
    this.server = new McpServerService(config, usersService);
    this.client = new McpClientService(config);
    this.gateway = new McpGatewayService(this.server, this.client);
    this.controller = new McpController(this.gateway, this.server);
  }

  async init(): Promise<void> {
    await this.server.init();
    await this.client.init();
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.server.close();
  }
}
