import { swaggerDocument } from './swagger-document';
import { swaggerUiHtml } from './swagger-ui.html';
import { swaggerUiInit } from './swagger-ui-init';

/**
 * The documentation surface is a published contract: the shell page, its
 * bootstrap script and the document itself are all served verbatim, so their
 * exact bytes are pinned here rather than left to whatever the asset package
 * happens to generate.
 */
describe('documentation assets', () => {
  it('serves the shell page at its published size', () => {
    expect(Buffer.byteLength(swaggerUiHtml, 'utf8')).toBe(3126);
  });

  it('points the shell page at assets alongside itself', () => {
    expect(swaggerUiHtml).toContain('href="./docs/swagger-ui.css"');
    expect(swaggerUiHtml).toContain('src="./docs/swagger-ui-bundle.js"');
    expect(swaggerUiHtml).toContain('src="./docs/swagger-ui-init.js"');
  });

  it('serves the bootstrap script at its published size', () => {
    expect(Buffer.byteLength(swaggerUiInit(), 'utf8')).toBe(11321);
  });

  it('inlines the document into the bootstrap script', () => {
    expect(swaggerUiInit()).toContain(
      JSON.stringify(
        { swaggerDoc: swaggerDocument, customOptions: {} },
        null,
        2,
      ),
    );
  });

  it('describes the api under its prefix', () => {
    expect(swaggerDocument.openapi).toBe('3.0.0');
    expect(swaggerDocument.info).toEqual({
      title: 'API',
      description: 'API Description',
      version: '1.0',
      contact: {},
    });
    expect(swaggerDocument.servers).toEqual([{ url: '/api' }]);
    expect(swaggerDocument.components.securitySchemes.bearer).toEqual({
      scheme: 'bearer',
      bearerFormat: 'JWT',
      type: 'http',
    });
  });
});
