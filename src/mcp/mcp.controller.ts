import type { IncomingMessage, ServerResponse } from 'http';

import {
  McpChatRequest,
  McpChatResponse,
  McpInventory,
  McpToolInvocationRequest,
  McpToolInvocationResponse,
} from './mcp.types';

import { BadRequestException } from '../common/http-exception';
import { McpGatewayService } from './mcp-gateway.service';
import { McpServerService } from './mcp-server.service';

export class McpController {
  constructor(
    private readonly gateway: McpGatewayService,
    private readonly server: McpServerService,
  ) {}

  inventory(): McpInventory {
    return this.gateway.inventory();
  }

  invoke(body: McpToolInvocationRequest): Promise<McpToolInvocationResponse> {
    return this.gateway.invokeTool(body);
  }

  resource(serverId: string, uri: string): Promise<McpToolInvocationResponse> {
    if (!serverId || !uri) {
      throw new BadRequestException(
        'Both "serverId" and "uri" query parameters are required.',
      );
    }
    return this.gateway
      .readResource(serverId, uri)
      .then((content) => ({ content }));
  }

  chat(body: McpChatRequest): Promise<McpChatResponse> {
    return this.gateway.chat(body);
  }

  /**
   * Native MCP Streamable HTTP transport. External MCP clients (Claude
   * Desktop / Code, mcp-cli, etc.) point at this URL and speak the
   * protocol directly. The Angular preview uses the JSON endpoints above
   * instead so the browser doesn't need to bundle the SDK.
   */
  async transport(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
  ): Promise<void> {
    await this.server.handleTransportRequest(req, res, body);
  }
}
