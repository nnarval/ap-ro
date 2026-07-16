var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/partyserver/dist/index.js
import { DurableObject, env } from "cloudflare:workers";

// node_modules/partyserver/node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/partyserver/node_modules/nanoid/index.browser.js
var nanoid = /* @__PURE__ */ __name((size = 21) => {
  let id = "";
  let bytes = crypto.getRandomValues(new Uint8Array(size |= 0));
  while (size--) {
    id += urlAlphabet[bytes[size] & 63];
  }
  return id;
}, "nanoid");

// node_modules/partyserver/dist/index.js
if (!("OPEN" in WebSocket)) {
  const WebSocketStatus = {
    CONNECTING: WebSocket.READY_STATE_CONNECTING,
    OPEN: WebSocket.READY_STATE_OPEN,
    CLOSING: WebSocket.READY_STATE_CLOSING,
    CLOSED: WebSocket.READY_STATE_CLOSED
  };
  Object.assign(WebSocket, WebSocketStatus);
  Object.assign(WebSocket.prototype, WebSocketStatus);
}
function tryGetPartyServerMeta(ws) {
  try {
    const attachment = WebSocket.prototype.deserializeAttachment.call(ws);
    if (!attachment || typeof attachment !== "object") return null;
    if (!("__pk" in attachment)) return null;
    const pk = attachment.__pk;
    if (!pk || typeof pk !== "object") return null;
    const { id, tags } = pk;
    if (typeof id !== "string") return null;
    const { uri } = pk;
    return {
      id,
      tags: Array.isArray(tags) ? tags : [],
      uri: typeof uri === "string" ? uri : void 0
    };
  } catch {
    return null;
  }
}
__name(tryGetPartyServerMeta, "tryGetPartyServerMeta");
function isPartyServerWebSocket(ws) {
  return tryGetPartyServerMeta(ws) !== null;
}
__name(isPartyServerWebSocket, "isPartyServerWebSocket");
var AttachmentCache = class {
  static {
    __name(this, "AttachmentCache");
  }
  #cache = /* @__PURE__ */ new WeakMap();
  get(ws) {
    let attachment = this.#cache.get(ws);
    if (!attachment) {
      attachment = WebSocket.prototype.deserializeAttachment.call(ws);
      if (attachment !== void 0) this.#cache.set(ws, attachment);
      else throw new Error("Missing websocket attachment. This is most likely an issue in PartyServer, please open an issue at https://github.com/cloudflare/partykit/issues");
    }
    return attachment;
  }
  set(ws, attachment) {
    this.#cache.set(ws, attachment);
    WebSocket.prototype.serializeAttachment.call(ws, attachment);
  }
};
var attachments = new AttachmentCache();
var connections = /* @__PURE__ */ new WeakSet();
var isWrapped = /* @__PURE__ */ __name((ws) => {
  return connections.has(ws);
}, "isWrapped");
var createLazyConnection = /* @__PURE__ */ __name((ws) => {
  if (isWrapped(ws)) return ws;
  let initialState;
  if ("state" in ws) {
    initialState = ws.state;
    delete ws.state;
  }
  const connection = Object.defineProperties(ws, {
    id: {
      configurable: true,
      get() {
        return attachments.get(ws).__pk.id;
      }
    },
    uri: {
      configurable: true,
      get() {
        return attachments.get(ws).__pk.uri ?? null;
      }
    },
    tags: {
      configurable: true,
      get() {
        return attachments.get(ws).__pk.tags ?? [];
      }
    },
    socket: {
      configurable: true,
      get() {
        return ws;
      }
    },
    state: {
      configurable: true,
      get() {
        return ws.deserializeAttachment();
      }
    },
    setState: {
      configurable: true,
      value: /* @__PURE__ */ __name(function setState(setState) {
        let state;
        if (setState instanceof Function) state = setState(this.state);
        else state = setState;
        ws.serializeAttachment(state);
        return state;
      }, "setState")
    },
    deserializeAttachment: {
      configurable: true,
      value: /* @__PURE__ */ __name(function deserializeAttachment() {
        return attachments.get(ws).__user ?? null;
      }, "deserializeAttachment")
    },
    serializeAttachment: {
      configurable: true,
      value: /* @__PURE__ */ __name(function serializeAttachment(attachment) {
        const setting = {
          ...attachments.get(ws),
          __user: attachment ?? null
        };
        attachments.set(ws, setting);
      }, "serializeAttachment")
    }
  });
  if (initialState) connection.setState(initialState);
  connections.add(connection);
  return connection;
}, "createLazyConnection");
var HibernatingConnectionIterator = class {
  static {
    __name(this, "HibernatingConnectionIterator");
  }
  index = 0;
  sockets;
  constructor(state, tag) {
    this.state = state;
    this.tag = tag;
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    const sockets = this.sockets ?? (this.sockets = this.state.getWebSockets(this.tag));
    let socket;
    while (socket = sockets[this.index++]) if (socket.readyState === WebSocket.READY_STATE_OPEN) {
      if (!isPartyServerWebSocket(socket)) continue;
      return {
        done: false,
        value: createLazyConnection(socket)
      };
    }
    return {
      done: true,
      value: void 0
    };
  }
};
function prepareTags(connectionId, userTags) {
  const tags = [connectionId, ...userTags.filter((t) => t !== connectionId)];
  if (tags.length > 10) throw new Error("A connection can only have 10 tags, including the default id tag.");
  for (const tag of tags) {
    if (typeof tag !== "string") throw new Error(`A connection tag must be a string. Received: ${tag}`);
    if (tag === "") throw new Error("A connection tag must not be an empty string.");
    if (tag.length > 256) throw new Error("A connection tag must not exceed 256 characters");
  }
  return tags;
}
__name(prepareTags, "prepareTags");
var InMemoryConnectionManager = class {
  static {
    __name(this, "InMemoryConnectionManager");
  }
  #connections = /* @__PURE__ */ new Map();
  tags = /* @__PURE__ */ new WeakMap();
  getCount() {
    return this.#connections.size;
  }
  getConnection(id) {
    return this.#connections.get(id);
  }
  *getConnections(tag) {
    if (!tag) {
      yield* this.#connections.values().filter((c) => c.readyState === WebSocket.READY_STATE_OPEN);
      return;
    }
    for (const connection of this.#connections.values()) if ((this.tags.get(connection) ?? []).includes(tag)) yield connection;
  }
  accept(connection, options) {
    try {
      connection.accept({ allowHalfOpen: true });
    } catch {
      connection.accept();
    }
    try {
      connection.binaryType = "arraybuffer";
    } catch {
    }
    const tags = prepareTags(connection.id, options.tags);
    this.#connections.set(connection.id, connection);
    this.tags.set(connection, tags);
    Object.defineProperty(connection, "tags", {
      get: /* @__PURE__ */ __name(() => tags, "get"),
      configurable: true
    });
    const removeConnection = /* @__PURE__ */ __name(() => {
      this.#connections.delete(connection.id);
      connection.removeEventListener("close", removeConnection);
      connection.removeEventListener("error", removeConnection);
    }, "removeConnection");
    connection.addEventListener("close", removeConnection);
    connection.addEventListener("error", removeConnection);
    return connection;
  }
};
var HibernatingConnectionManager = class {
  static {
    __name(this, "HibernatingConnectionManager");
  }
  constructor(controller) {
    this.controller = controller;
  }
  getCount() {
    let count = 0;
    for (const ws of this.controller.getWebSockets()) if (isPartyServerWebSocket(ws)) count++;
    return count;
  }
  getConnection(id) {
    const matching = this.controller.getWebSockets(id).filter((ws) => {
      return tryGetPartyServerMeta(ws)?.id === id;
    });
    if (matching.length === 0) return void 0;
    if (matching.length === 1) return createLazyConnection(matching[0]);
    throw new Error(`More than one connection found for id ${id}. Did you mean to use getConnections(tag) instead?`);
  }
  getConnections(tag) {
    return new HibernatingConnectionIterator(this.controller, tag);
  }
  accept(connection, options) {
    const tags = prepareTags(connection.id, options.tags);
    this.controller.acceptWebSocket(connection, tags);
    connection.serializeAttachment({
      __pk: {
        id: connection.id,
        tags,
        uri: connection.uri ?? void 0
      },
      __user: null
    });
    return createLazyConnection(connection);
  }
};
var CLOSING = 2;
var CLOSED = 3;
function isBenignTeardownError(ws, error) {
  const state = ws.readyState;
  if (state !== CLOSING && state !== CLOSED) return false;
  if (typeof error !== "object" || error === null) return false;
  const typed = error;
  if (typed.retryable === true) return true;
  const message = typeof typed.message === "string" ? typed.message : "";
  return /Network connection lost|WebSocket peer disconnected/i.test(message);
}
__name(isBenignTeardownError, "isBenignTeardownError");
var NAME_STORAGE_KEY = "__ps_name";
function isReservedCloseCode(code) {
  return code === 1005 || code === 1006 || code === 1015;
}
__name(isReservedCloseCode, "isReservedCloseCode");
function closeQuietly(ws, code, reason) {
  if (isReservedCloseCode(code)) return;
  try {
    ws.close(code, reason);
  } catch {
  }
}
__name(closeQuietly, "closeQuietly");
var serverMapCache = /* @__PURE__ */ new WeakMap();
var bindingNameCache = /* @__PURE__ */ new WeakMap();
var DEFAULT_ROUTING_RETRY_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 800
};
function durableObjectGetOptions(options) {
  return options?.locationHint ? { locationHint: options.locationHint } : void 0;
}
__name(durableObjectGetOptions, "durableObjectGetOptions");
function validatePositiveInteger(value, name) {
  if (!Number.isFinite(value) || value < 1) throw new Error(`${name} must be >= 1`);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
}
__name(validatePositiveInteger, "validatePositiveInteger");
function validatePositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be > 0`);
}
__name(validatePositiveNumber, "validatePositiveNumber");
function resolveRoutingRetryOptions(options) {
  if (options === false) return null;
  const resolved = {
    maxAttempts: options?.maxAttempts ?? DEFAULT_ROUTING_RETRY_OPTIONS.maxAttempts,
    baseDelayMs: options?.baseDelayMs ?? DEFAULT_ROUTING_RETRY_OPTIONS.baseDelayMs,
    maxDelayMs: options?.maxDelayMs ?? DEFAULT_ROUTING_RETRY_OPTIONS.maxDelayMs,
    onRetry: options?.onRetry
  };
  validatePositiveInteger(resolved.maxAttempts, "routingRetry.maxAttempts");
  validatePositiveNumber(resolved.baseDelayMs, "routingRetry.baseDelayMs");
  validatePositiveNumber(resolved.maxDelayMs, "routingRetry.maxDelayMs");
  if (resolved.baseDelayMs > resolved.maxDelayMs) throw new Error("routingRetry.baseDelayMs must be <= maxDelayMs");
  return resolved;
}
__name(resolveRoutingRetryOptions, "resolveRoutingRetryOptions");
function isRetryableDurableObjectError(error) {
  if (typeof error !== "object" || error === null) return false;
  const typed = error;
  return typed.retryable === true && typed.overloaded !== true;
}
__name(isRetryableDurableObjectError, "isRetryableDurableObjectError");
function routingRetryDelayMs(attempt, options) {
  const upperBoundMs = Math.min(options.maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(Math.random() * upperBoundMs);
}
__name(routingRetryDelayMs, "routingRetryDelayMs");
async function retryDurableObjectOperation(operation, context, retryOptions) {
  const resolved = resolveRoutingRetryOptions(retryOptions);
  if (!resolved) return await operation();
  let attempt = 1;
  while (true) try {
    return await operation();
  } catch (error) {
    const nextAttempt = attempt + 1;
    if (nextAttempt > resolved.maxAttempts || !isRetryableDurableObjectError(error)) throw error;
    const delayMs = routingRetryDelayMs(attempt, resolved);
    try {
      await resolved.onRetry?.({
        error,
        attempt,
        maxAttempts: resolved.maxAttempts,
        delayMs,
        name: context.name,
        className: context.className
      });
    } catch (callbackError) {
      console.warn("PartyServer routingRetry onRetry callback failed:", callbackError);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempt = nextAttempt;
  }
}
__name(retryDurableObjectOperation, "retryDurableObjectOperation");
function encodeProps(props) {
  const bytes = new TextEncoder().encode(JSON.stringify(props));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
__name(encodeProps, "encodeProps");
function decodeProps(header) {
  const trimmed = header.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  const binary = atob(header);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}
__name(decodeProps, "decodeProps");
function camelCaseToKebabCase(str) {
  if (str === str.toUpperCase() && str !== str.toLowerCase()) return str.toLowerCase().replace(/_/g, "-");
  let kebabified = str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  kebabified = kebabified.startsWith("-") ? kebabified.slice(1) : kebabified;
  return kebabified.replace(/_/g, "-").replace(/-$/, "");
}
__name(camelCaseToKebabCase, "camelCaseToKebabCase");
function resolveCorsHeaders(cors) {
  if (cors === true) return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  };
  if (cors && typeof cors === "object") {
    const h = new Headers(cors);
    const record = {};
    h.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  return null;
}
__name(resolveCorsHeaders, "resolveCorsHeaders");
async function routePartykitRequest(req, env$1 = env, options) {
  if (!serverMapCache.has(env$1)) {
    const namespaceMap = {};
    const bindingNames2 = {};
    for (const [k, v] of Object.entries(env$1)) if (v && typeof v === "object" && "idFromName" in v && typeof v.idFromName === "function") {
      const kebab = camelCaseToKebabCase(k);
      namespaceMap[kebab] = v;
      bindingNames2[kebab] = k;
    }
    serverMapCache.set(env$1, namespaceMap);
    bindingNameCache.set(env$1, bindingNames2);
  }
  const map = serverMapCache.get(env$1);
  const bindingNames = bindingNameCache.get(env$1);
  const prefixParts = (options?.prefix || "parties").split("/");
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  if (!prefixParts.every((part, index) => parts[index] === part) || parts.length < prefixParts.length + 2) return null;
  const namespace = parts[prefixParts.length];
  const name = parts[prefixParts.length + 1];
  if (name && namespace) {
    let withCorsHeaders = function(response2) {
      if (!corsHeaders || isWebSocket) return response2;
      const newResponse = new Response(response2.body, response2);
      for (const [key, value] of Object.entries(corsHeaders)) newResponse.headers.set(key, value);
      return newResponse;
    };
    __name(withCorsHeaders, "withCorsHeaders");
    if (!map[namespace]) {
      if (namespace === "main") {
        console.warn("You appear to be migrating a PartyKit project to PartyServer.");
        console.warn(`PartyServer doesn't have a "main" party by default. Try adding this to your PartySocket client:
 
party: "${camelCaseToKebabCase(Object.keys(map)[0])}"`);
      } else console.error(`The url ${req.url}  with namespace "${namespace}" and name "${name}" does not match any server namespace. 
Did you forget to add a durable object binding to the class ${namespace[0].toUpperCase() + namespace.slice(1)} in your wrangler.jsonc?`);
      return new Response("Invalid request", { status: 400 });
    }
    const corsHeaders = resolveCorsHeaders(options?.cors);
    const isWebSocket = req.headers.get("Upgrade")?.toLowerCase() === "websocket";
    if (req.method === "OPTIONS" && corsHeaders) return new Response(null, { headers: corsHeaders });
    let doNamespace = map[namespace];
    if (options?.jurisdiction) doNamespace = doNamespace.jurisdiction(options.jurisdiction);
    const id = doNamespace.idFromName(name);
    const getOptions = durableObjectGetOptions(options);
    req = new Request(req);
    req.headers.set("x-partykit-namespace", namespace);
    if (options?.jurisdiction) req.headers.set("x-partykit-jurisdiction", options.jurisdiction);
    const className = bindingNames[namespace];
    let partyDeprecationWarned = false;
    const lobby = {
      get party() {
        if (!partyDeprecationWarned) {
          partyDeprecationWarned = true;
          console.warn('lobby.party is deprecated and currently returns the kebab-case namespace (e.g. "my-agent"). Use lobby.className instead to get the Durable Object class name (e.g. "MyAgent"). In the next major version, lobby.party will return the class name.');
        }
        return namespace;
      },
      className,
      name
    };
    if (isWebSocket) {
      if (options?.onBeforeConnect) {
        const reqOrRes = await options.onBeforeConnect(req, lobby);
        if (reqOrRes instanceof Request) req = reqOrRes;
        else if (reqOrRes instanceof Response) return reqOrRes;
      }
    } else if (options?.onBeforeRequest) {
      const reqOrRes = await options.onBeforeRequest(req, lobby);
      if (reqOrRes instanceof Request) req = reqOrRes;
      else if (reqOrRes instanceof Response) return withCorsHeaders(reqOrRes);
    }
    if (options?.props !== void 0) req.headers.set("x-partykit-props", encodeProps(options.props));
    const response = await retryDurableObjectOperation(() => doNamespace.get(id, getOptions).fetch(req.clone()), {
      name,
      className
    }, options?.routingRetry);
    return isWebSocket ? response : withCorsHeaders(response);
  } else return null;
}
__name(routePartykitRequest, "routePartykitRequest");
var Server = class extends DurableObject {
  static {
    __name(this, "Server");
  }
  static options = { hibernate: false };
  #status = "zero";
  #ParentClass = Object.getPrototypeOf(this).constructor;
  #connectionManager = this.#ParentClass.options.hibernate ? new HibernatingConnectionManager(this.ctx) : new InMemoryConnectionManager();
  /**
  * Execute SQL queries against the Server's database
  * @template T Type of the returned rows
  * @param strings SQL query template strings
  * @param values Values to be inserted into the query
  * @returns Array of query results
  */
  sql(strings, ...values) {
    let query = "";
    try {
      query = strings.reduce((acc, str, i) => acc + str + (i < values.length ? "?" : ""), "");
      return [...this.ctx.storage.sql.exec(query, ...values)];
    } catch (e) {
      console.error(`failed to execute sql query: ${query}`, e);
      throw this.onException(e);
    }
  }
  constructor(ctx, env2) {
    super(ctx, env2);
  }
  /**
  * Handle incoming requests to the server.
  */
  async fetch(request) {
    try {
      const props = request.headers.get("x-partykit-props");
      if (props) this.#_props = decodeProps(props);
      if (!this.ctx.id.name && !this.#_name) {
        const room = request.headers.get("x-partykit-room");
        if (room) this.#_name = room;
      }
      await this.#ensureInitialized();
      if (!this.ctx.id.name && !this.#_name) throw new Error(`Cannot determine the name for ${this.#ParentClass.name}: this.ctx.id.name is undefined, no legacy __ps_name storage record is present, and no x-partykit-room header was supplied. Likely causes:
  1. The stub was built via idFromString()/newUniqueId(). PartyServer requires name-based addressing (idFromName/getByName).
  2. The workerd/wrangler runtime is too old to expose ctx.id.name \u2014 update to a recent wrangler release.
  3. You called stub.fetch() directly without going through routePartykitRequest()/getServerByName(). Prefer those, or set the x-partykit-room header.`);
      const url = new URL(request.url);
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return await this.onRequest(request);
      else {
        const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
        let connectionId = url.searchParams.get("_pk");
        if (!connectionId) connectionId = nanoid();
        let connection = Object.assign(serverWebSocket, {
          id: connectionId,
          uri: request.url,
          server: this.name,
          tags: [],
          state: null,
          setState(setState) {
            let state;
            if (setState instanceof Function) state = setState(this.state);
            else state = setState;
            this.state = state;
            return this.state;
          }
        });
        const ctx = { request };
        const tags = await this.getConnectionTags(connection, ctx);
        connection = this.#connectionManager.accept(connection, { tags });
        if (!this.#ParentClass.options.hibernate) this.#attachSocketEventHandlers(connection);
        await this.onConnect(connection, ctx);
        return new Response(null, {
          status: 101,
          webSocket: clientWebSocket
        });
      }
    } catch (err) {
      console.error(`Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} fetch:`, err);
      if (!(err instanceof Error)) throw err;
      if (request.headers.get("Upgrade") === "websocket") {
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({ error: err.stack }));
        pair[1].close(1011, "Uncaught exception during session setup");
        return new Response(null, {
          status: 101,
          webSocket: pair[0]
        });
      } else return new Response(err.stack, { status: 500 });
    }
  }
  async webSocketMessage(ws, message) {
    if (!isPartyServerWebSocket(ws)) return;
    try {
      const connection = createLazyConnection(ws);
      await this.#ensureInitialized();
      connection.server = this.name;
      return this.onMessage(connection, message);
    } catch (e) {
      console.error(`Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} webSocketMessage:`, e);
    }
  }
  async webSocketClose(ws, code, reason, wasClean) {
    if (!isPartyServerWebSocket(ws)) return;
    try {
      const connection = createLazyConnection(ws);
      await this.#ensureInitialized();
      connection.server = this.name;
      await this.onClose(connection, code, reason, wasClean);
    } catch (e) {
      console.error(`Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} webSocketClose:`, e);
    } finally {
      closeQuietly(ws, code, reason);
    }
  }
  async webSocketError(ws, error) {
    if (!isPartyServerWebSocket(ws)) return;
    if (isBenignTeardownError(ws, error)) return;
    try {
      const connection = createLazyConnection(ws);
      await this.#ensureInitialized();
      connection.server = this.name;
      return this.onError(connection, error);
    } catch (e) {
      console.error(`Error in ${this.#ParentClass.name}:${this.ctx.id.name ?? this.#_name ?? "<unnamed>"} webSocketError:`, e);
    }
  }
  /**
  * Read the legacy `__ps_name` storage record as a fallback source of
  * `this.name` when `ctx.id.name` is unavailable. Covers:
  *
  *   1. Alarm handlers firing on alarm records that were scheduled by
  *      a workerd version that did not yet persist `name` into the
  *      alarm record (see the Durable Objects ID docs:
  *      https://developers.cloudflare.com/durable-objects/api/id/#name).
  *      The runtime contract for current workerd populates `ctx.id.name`
  *      in alarm handlers — see the "Raw runtime contract" tests — so
  *      this fallback exists primarily for stale on-disk alarm records
  *      and for defense-in-depth against future runtime changes.
  *   2. Legacy framework-level bootstrap patterns that write
  *      `__ps_name` directly (or call `setName()`) before triggering
  *      `__unsafe_ensureInitialized()` — typically DOs addressed via
  *      `idFromString()` / `newUniqueId()` plus a name override.
  */
  async #hydrateNameFromLegacyStorage() {
    if (this.#_name) return;
    const stored = await this.ctx.storage.get(NAME_STORAGE_KEY);
    if (stored) this.#_name = stored;
  }
  async #persistNameFallbackFromCtxId() {
    const ctxName = this.ctx.id.name;
    if (ctxName === void 0 || this.#_name) return;
    if (await this.ctx.storage.get(NAME_STORAGE_KEY) !== ctxName) await this.ctx.storage.put(NAME_STORAGE_KEY, ctxName);
    this.#_name = ctxName;
  }
  /**
  * @internal — Do not use directly. This is an escape hatch for frameworks
  * (like Agents) that receive calls via native DO RPC, bypassing the
  * standard fetch/alarm/webSocket entry points where initialization
  * normally happens. Calling this from application code is unsupported
  * and may break without notice.
  */
  async __unsafe_ensureInitialized() {
    await this.#ensureInitialized();
  }
  async #ensureInitialized() {
    if (this.#status === "started") return;
    if (this.ctx.id.name !== void 0) await this.#persistNameFallbackFromCtxId();
    else if (!this.#_name) await this.#hydrateNameFromLegacyStorage();
    let error;
    await this.ctx.blockConcurrencyWhile(async () => {
      this.#status = "starting";
      try {
        await this.onStart(this.#_props);
        this.#status = "started";
      } catch (e) {
        this.#status = "zero";
        error = e;
      }
    });
    if (error) throw error;
  }
  #attachSocketEventHandlers(connection) {
    const handleMessageFromClient = /* @__PURE__ */ __name((event) => {
      this.onMessage(connection, event.data)?.catch((e) => {
        console.error("onMessage error:", e);
      });
    }, "handleMessageFromClient");
    const reciprocateClose = /* @__PURE__ */ __name((event) => {
      closeQuietly(connection, event.code, event.reason);
    }, "reciprocateClose");
    const handleCloseFromClient = /* @__PURE__ */ __name((event) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("close", handleCloseFromClient);
      let result;
      try {
        result = this.onClose(connection, event.code, event.reason, event.wasClean);
      } catch (e) {
        console.error("onClose error:", e);
        reciprocateClose(event);
        return;
      }
      if (result && typeof result.then === "function") result.catch((e) => {
        console.error("onClose error:", e);
      }).finally(() => reciprocateClose(event));
      else reciprocateClose(event);
    }, "handleCloseFromClient");
    const handleErrorFromClient = /* @__PURE__ */ __name((e) => {
      connection.removeEventListener("message", handleMessageFromClient);
      connection.removeEventListener("error", handleErrorFromClient);
      if (isBenignTeardownError(connection, e.error)) return;
      this.onError(connection, e.error)?.catch((err) => {
        console.error("onError error:", err);
      });
    }, "handleErrorFromClient");
    connection.addEventListener("close", handleCloseFromClient);
    connection.addEventListener("error", handleErrorFromClient);
    connection.addEventListener("message", handleMessageFromClient);
  }
  #_name;
  /**
  * The name for this server.
  *
  * Resolves from `this.ctx.id.name` — the native DO id name, populated
  * whenever the stub was created via `idFromName()` or `getByName()`.
  * This is available inside every entry point (including the constructor,
  * alarms, and hibernating websocket handlers).
  *
  * For alarm handlers firing on stale on-disk alarm records from
  * older workerd versions that didn't persist `name` into the alarm
  * record, the name is recovered from a storage fallback record.
  *
  * Throws if neither source is available — typically this means the DO
  * was addressed via `idFromString()` or `newUniqueId()`, which is not
  * supported by PartyServer.
  */
  get name() {
    const ctxName = this.ctx.id.name;
    if (ctxName !== void 0) return ctxName;
    if (this.#_name) return this.#_name;
    throw new Error(`Attempting to read .name on ${this.#ParentClass.name}, but this.ctx.id.name is not set and no ${NAME_STORAGE_KEY} fallback record is available. PartyServer requires DOs to be addressed via idFromName()/getByName(), or explicitly bootstrapped with setName() when using idFromString()/newUniqueId(). If this happens in an alarm handler firing on a stale alarm record, initialize the DO from a fetch/RPC entry point first so PartyServer can persist the fallback name.`);
  }
  /**
  * Establish this server's name and trigger `onStart()`.
  *
  * Use cases:
  *
  *   1. **Framework-level bootstrap of DOs where `ctx.id.name` is
  *      undefined** — e.g. DOs addressed via `idFromString()` /
  *      `newUniqueId()`. `setName()` stashes the name in memory and
  *      persists it under `__ps_name` so cold-wake invocations
  *      recover it via `#ensureInitialized()`'s legacy fallback.
  *   2. **Delivering initial `props` to `onStart()`** via the
  *      optional second argument.
  *
  * For DOs addressed via `idFromName()` / `getByName()`, calling
  * `setName()` is redundant — `this.name` is available automatically
  * from `ctx.id.name`. The normal initialization path also persists
  * a fallback record so old-compat alarm handlers can recover the name.
  * Throws if `name` does not match `ctx.id.name`.
  *
  * **Not appropriate for facets.** Cloudflare Agents and any other
  * framework using `ctx.facets.get(...)` should pass an explicit
  * `id` in `FacetStartupOptions` so the facet has its own
  * `ctx.id.name`:
  *
  * ```ts
  * const stub = ctx.facets.get(facetKey, () => ({
  *   class: ChildClass,
  *   id: ctx.exports.SomeBoundDOClass.idFromName(facetName),
  * }));
  * ```
  *
  * Without an explicit `id`, the facet inherits the parent DO's
  * `ctx.id` (including `ctx.id.name`), and `setName()` will throw
  * the ctx.id.name-mismatch error because the facet's intended
  * name differs from the parent's. See
  * https://developers.cloudflare.com/dynamic-workers/usage/durable-object-facets/
  * for the `FacetStartupOptions.id` semantics.
  *
  * @deprecated for callers that address DOs via `idFromName()` /
  * `getByName()`. Still the supported API for framework-level
  * bootstrap of header/`newUniqueId`-addressed DOs and for
  * delivering initial `props` to `onStart()`.
  */
  async setName(name, props) {
    if (!name) throw new Error("A name is required.");
    const ctxName = this.ctx.id.name;
    if (ctxName !== void 0 && ctxName !== name) throw new Error(`This server's Durable Object id was created for name "${ctxName}", cannot setName to "${name}".`);
    if (this.#_name && this.#_name !== name) throw new Error(`This server already has a name: ${this.#_name}, attempting to set to: ${name}`);
    if (props !== void 0) this.#_props = props;
    if (!this.#_name && ctxName === void 0) {
      await this.ctx.storage.put(NAME_STORAGE_KEY, name);
      this.#_name = name;
    }
    await this.#ensureInitialized();
  }
  /**
  * @internal
  * @deprecated Retained for backward compatibility with older callers.
  * `routePartykitRequest` no longer uses this method; it sends props via
  * the `x-partykit-props` header on the underlying `fetch()` request.
  */
  async _initAndFetch(name, props, request) {
    await this.setName(name, props);
    return this.fetch(request);
  }
  #sendMessageToConnection(connection, message) {
    try {
      connection.send(message);
    } catch (_e) {
      connection.close(1011, "Unexpected error");
    }
  }
  /** Send a message to all connected clients, except connection ids listed in `without` */
  broadcast(msg, without) {
    for (const connection of this.#connectionManager.getConnections()) if (!without || !without.includes(connection.id)) this.#sendMessageToConnection(connection, msg);
  }
  /** Get a connection by connection id */
  getConnection(id) {
    return this.#connectionManager.getConnection(id);
  }
  /**
  * Get all connections. Optionally, you can provide a tag to filter returned connections.
  * Use `Server#getConnectionTags` to tag the connection on connect.
  */
  getConnections(tag) {
    return this.#connectionManager.getConnections(tag);
  }
  /**
  * You can tag a connection to filter them in Server#getConnections.
  * Each connection supports up to 9 tags, each tag max length is 256 characters.
  */
  getConnectionTags(connection, context) {
    return [];
  }
  #_props;
  /**
  * Called when the server is started for the first time.
  */
  onStart(props) {
  }
  /**
  * Called when a new connection is made to the server.
  */
  onConnect(connection, ctx) {
  }
  /**
  * Called when a message is received from a connection.
  */
  onMessage(connection, message) {
  }
  /**
  * Called when a connection is closed.
  */
  onClose(connection, code, reason, wasClean) {
  }
  /**
  * Called when an error occurs on a connection.
  */
  onError(connection, error) {
    console.error(`Error on connection ${connection.id} in ${this.#ParentClass.name}:${this.name}:`, error);
    console.info(`Implement onError on ${this.#ParentClass.name} to handle this error.`);
  }
  /**
  * Called when a request is made to the server.
  */
  onRequest(request) {
    console.warn(`onRequest hasn't been implemented on ${this.#ParentClass.name}:${this.name} responding to ${request.url}`);
    return new Response("Not implemented", { status: 404 });
  }
  /**
  * Called when an exception occurs.
  * @param error - The error that occurred.
  */
  onException(error) {
    console.error(`Exception in ${this.#ParentClass.name}:${this.name}:`, error);
    console.info(`Implement onException on ${this.#ParentClass.name} to handle this error.`);
  }
  onAlarm() {
    console.log(`Implement onAlarm on ${this.#ParentClass.name} to handle alarms.`);
  }
  async alarm() {
    await this.#ensureInitialized();
    await this.onAlarm();
  }
};

// src/game/config.ts
var REGLAGES = {
  /** Étoiles à distribuer avant la fin de la partie. */
  etoilesParPartie: 10,
  /** Étoiles présentes en même temps sur le plateau. Une étoile ramassée
   *  réapparaît aussitôt ailleurs pour maintenir ce nombre. */
  etoilesSurPlateau: 2,
  /** L'étoile posée sur le plateau se trouve : elle est gratuite. Celle de la
   *  boutique s'achète. Ce sont les deux sources voulues. */
  prixEtoileBoutique: 10,
  /** 1 pièce = 1 gorgée à distribuer pendant la partie. */
  prixGorgee: 1,
  pionsMin: 2,
  pionsMax: 6,
  deMin: 1,
  deMax: 6,
  casesMin: 26,
  casesMax: 34,
  raccourcisMin: 1,
  raccourcisMax: 2,
  piecesDepart: 5,
  /** La case bonus rapporte un montant variable : ça évite d'avoir à créer un
   *  type « gros bonus », qui coûterait une couleur pour une simple magnitude. */
  gainBonusMin: 2,
  gainBonusMax: 6,
  /** Le malus doit faire réagir sans plomber la partie. Le joueur peut toujours
   *  préférer le gage. */
  perteMalus: 2,
  /** Provisoire, en attendant le contenu des défis. */
  gainDefiDuel: 5,
  /** Gorgées bues par le perdant du défi instantané, quand deux pions se
   *  retrouvent sur la même case. Ce n'est pas de l'état de jeu : on l'affiche,
   *  les joueurs boivent. */
  gorgeesPerdantInstantane: 5,
  gainTourComplet: 4
};
var EFFECTIFS_FIXES = {
  emplacementsEtoile: { min: 4, max: 6 },
  evenement: { min: 3, max: 4 },
  boutique: { min: 3, max: 4 }
};
var PARTS_MAJORITAIRES = {
  defi: 7,
  bonus: 6,
  malus: 5
};

// src/game/rng.ts
function tirer(etat) {
  let a = etat + 1831565813 >>> 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return [((t ^ t >>> 14) >>> 0) / 4294967296, a];
}
__name(tirer, "tirer");
function tirerEntier(etat, min, max) {
  const [v, suivant] = tirer(etat);
  return [min + Math.floor(v * (max - min + 1)), suivant];
}
__name(tirerEntier, "tirerEntier");
function tirerElement(etat, liste) {
  const [i, suivant] = tirerEntier(etat, 0, liste.length - 1);
  return [liste[i], suivant];
}
__name(tirerElement, "tirerElement");
function creerRng(graine) {
  let etat = graine >>> 0;
  return {
    reel() {
      const [v, suivant] = tirer(etat);
      etat = suivant;
      return v;
    },
    entier(min, max) {
      const [v, suivant] = tirerEntier(etat, min, max);
      etat = suivant;
      return v;
    },
    element(liste) {
      const [v, suivant] = tirerElement(etat, liste);
      etat = suivant;
      return v;
    },
    /** Mélange de Fisher-Yates, sur une copie. */
    melanger(liste) {
      const copie = [...liste];
      for (let i = copie.length - 1; i > 0; i--) {
        const j = this.entier(0, i);
        [copie[i], copie[j]] = [copie[j], copie[i]];
      }
      return copie;
    },
    get etat() {
      return etat;
    }
  };
}
__name(creerRng, "creerRng");
function graineAleatoire() {
  return Math.random() * 4294967295 >>> 0;
}
__name(graineAleatoire, "graineAleatoire");

// src/game/defis.ts
var DEFIS = [
  // --- Instantanés : le dernier à obéir a perdu. ---
  {
    id: "i-front",
    categorie: "instantane",
    titre: "Touche ton front",
    consigne: "Le dernier \xE0 toucher son front a perdu.",
    modes: ["local", "multi"]
  },
  {
    id: "i-verre",
    categorie: "instantane",
    titre: "Touche ton verre",
    consigne: "Le dernier \xE0 poser un doigt sur son verre a perdu.",
    modes: ["local", "multi"]
  },
  {
    id: "i-sol",
    categorie: "instantane",
    titre: "Touche le sol",
    consigne: "Le dernier \xE0 toucher le sol a perdu.",
    modes: ["local", "multi"]
  },
  {
    id: "i-nez",
    categorie: "instantane",
    titre: "Doigt sur le nez",
    consigne: "Le dernier \xE0 mettre un doigt sur son nez a perdu.",
    modes: ["local", "multi"]
  },
  {
    id: "i-debout",
    categorie: "instantane",
    titre: "Debout !",
    consigne: "Le dernier debout sur ses deux pieds a perdu.",
    modes: ["local", "multi"]
  },
  {
    id: "i-silence",
    categorie: "instantane",
    titre: "Chut",
    consigne: "Le premier qui parle ou qui rit a perdu.",
    modes: ["local", "multi"]
  },
  // --- Duels : à remplir. ---
  {
    id: "d-a-venir-1",
    categorie: "duel",
    titre: "Duel",
    consigne: "Contenu \xE0 venir. Faites-vous un duel et d\xE9signez le vainqueur.",
    modes: ["local", "multi"]
  },
  {
    id: "d-a-venir-2",
    categorie: "duel",
    titre: "Duel",
    consigne: "Contenu \xE0 venir. Faites-vous un duel et d\xE9signez le vainqueur.",
    modes: ["local", "multi"]
  },
  // --- Collectifs : à remplir. ---
  {
    id: "c-a-venir-1",
    categorie: "collectif",
    titre: "D\xE9fi de fin de manche",
    consigne: "Contenu \xE0 venir. Jouez tous, puis d\xE9signez le vainqueur.",
    modes: ["local", "multi"]
  },
  {
    id: "c-a-venir-2",
    categorie: "collectif",
    titre: "D\xE9fi de fin de manche",
    consigne: "Contenu \xE0 venir. Jouez tous, puis d\xE9signez le vainqueur.",
    modes: ["local", "multi"]
  }
];
var PAR_ID = new Map(DEFIS.map((d) => [d.id, d]));
function tirerDefi(categorie, mode, rng) {
  const candidats = DEFIS.filter((d) => d.categorie === categorie && d.modes.includes(mode));
  if (candidats.length === 0) return [null, rng];
  const [i, suivant] = tirerEntier(rng, 0, candidats.length - 1);
  return [candidats[i].id, suivant];
}
__name(tirerDefi, "tirerDefi");

// src/game/plateau.ts
function repartir(total, parts) {
  const sommeParts = Object.values(parts).reduce((a, b) => a + b, 0);
  const exacts = Object.entries(parts).map(([cle, p]) => ({
    cle,
    exact: total * p / sommeParts
  }));
  const resultat = {};
  let attribue = 0;
  for (const { cle, exact } of exacts) {
    resultat[cle] = Math.floor(exact);
    attribue += resultat[cle];
  }
  const parDecimale = [...exacts].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact))
  );
  for (let i = 0; attribue < total; i++, attribue++) {
    resultat[parDecimale[i % parDecimale.length].cle]++;
  }
  return resultat;
}
__name(repartir, "repartir");
function genererPlateau(graine) {
  const rng = creerRng(graine);
  const cases = {};
  const nb = rng.entier(REGLAGES.casesMin, REGLAGES.casesMax);
  const rayonBase = 300;
  const harmoniques = [0, 1, 2].map(() => ({
    frequence: rng.entier(2, 5),
    amplitude: 0.06 + rng.reel() * 0.12,
    phase: rng.reel() * Math.PI * 2
  }));
  const rayonA = /* @__PURE__ */ __name((angle) => {
    let facteur = 1;
    for (const h of harmoniques) facteur += h.amplitude * Math.sin(h.frequence * angle + h.phase);
    return rayonBase * facteur;
  }, "rayonA");
  const pasAngulaire = Math.PI * 2 / nb;
  for (let i = 0; i < nb; i++) {
    const angle = i * pasAngulaire + (rng.reel() - 0.5) * pasAngulaire * 0.5;
    const rayon = rayonA(angle);
    cases[`c${i}`] = {
      id: `c${i}`,
      type: "bonus",
      x: Math.cos(angle) * rayon,
      y: Math.sin(angle) * rayon,
      suivantes: [`c${(i + 1) % nb}`]
    };
  }
  const nbRaccourcis = rng.entier(REGLAGES.raccourcisMin, REGLAGES.raccourcisMax);
  const departsUtilises = /* @__PURE__ */ new Set();
  for (let k = 0; k < nbRaccourcis; k++) {
    const depart = rng.entier(0, nb - 1);
    const idDepart = `c${depart}`;
    const arrivee = (depart + Math.floor(nb / 2) + rng.entier(-2, 2) + nb) % nb;
    const idArrivee = `c${arrivee}`;
    if (idDepart === "c0" || idArrivee === "c0" || departsUtilises.has(idDepart) || idDepart === idArrivee) {
      continue;
    }
    departsUtilises.add(idDepart);
    const a = cases[idDepart];
    const b = cases[idArrivee];
    const cx = (rng.reel() - 0.5) * rayonBase * 0.5;
    const cy = (rng.reel() - 0.5) * rayonBase * 0.5;
    const longueur = rng.entier(3, 5);
    const ids = [];
    for (let i = 1; i <= longueur; i++) {
      const t = i / (longueur + 1);
      const u = 1 - t;
      const id = `r${k}_${i}`;
      ids.push(id);
      cases[id] = {
        id,
        type: "bonus",
        x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
        suivantes: []
      };
    }
    for (let i = 0; i < ids.length; i++) {
      cases[ids[i]].suivantes = [i + 1 < ids.length ? ids[i + 1] : idArrivee];
    }
    a.suivantes = [...a.suivantes, ids[0]];
  }
  const assignees = /* @__PURE__ */ new Set(["c0"]);
  cases.c0.type = "depart";
  const nbEtoiles = rng.entier(
    EFFECTIFS_FIXES.emplacementsEtoile.min,
    EFFECTIFS_FIXES.emplacementsEtoile.max
  );
  const emplacementsEtoile = [];
  const ecart = nb / nbEtoiles;
  for (let i = 0; i < nbEtoiles; i++) {
    const brut = Math.round(i * ecart + rng.entier(-1, 1));
    let index = (brut % nb + nb) % nb;
    if (index === 0) index = 1;
    const id = `c${index}`;
    if (!assignees.has(id)) {
      assignees.add(id);
      emplacementsEtoile.push(id);
      cases[id].type = "etoile";
    }
  }
  const restant = rng.melanger(Object.keys(cases).filter((id) => !assignees.has(id)));
  const nbEvenement = Math.min(
    rng.entier(EFFECTIFS_FIXES.evenement.min, EFFECTIFS_FIXES.evenement.max),
    restant.length
  );
  const nbBoutique = Math.min(
    rng.entier(EFFECTIFS_FIXES.boutique.min, EFFECTIFS_FIXES.boutique.max),
    restant.length - nbEvenement
  );
  const majoritaires = repartir(restant.length - nbEvenement - nbBoutique, PARTS_MAJORITAIRES);
  const idsRaccourcis = restant.filter((id) => id.startsWith("r"));
  const idsCircuit = restant.filter((id) => !id.startsWith("r"));
  const parPrioriteMalus = [
    ...idsRaccourcis.slice(0, Math.min(Math.ceil(majoritaires.malus / 2), idsRaccourcis.length)),
    ...idsCircuit,
    ...idsRaccourcis
  ];
  const poser = /* @__PURE__ */ __name((id, type) => {
    cases[id].type = type;
    assignees.add(id);
  }, "poser");
  for (const id of parPrioriteMalus) {
    if (majoritaires.malus === 0) break;
    if (assignees.has(id)) continue;
    poser(id, "malus");
    majoritaires.malus--;
  }
  const reste = restant.filter((id) => !assignees.has(id));
  const aServir = [
    ["evenement", nbEvenement],
    ["boutique", nbBoutique],
    ["defi", majoritaires.defi],
    ["bonus", majoritaires.bonus]
  ];
  let curseur = 0;
  for (const [type, combien] of aServir) {
    for (let i = 0; i < combien && curseur < reste.length; i++, curseur++) {
      poser(reste[curseur], type);
    }
  }
  for (const id of reste.slice(curseur)) poser(id, "bonus");
  const xs = Object.values(cases).map((c) => c.x);
  const ys = Object.values(cases).map((c) => c.y);
  const marge = 60;
  return {
    graine,
    cases,
    depart: "c0",
    emplacementsEtoile,
    limites: {
      minX: Math.min(...xs) - marge,
      minY: Math.min(...ys) - marge,
      maxX: Math.max(...xs) + marge,
      maxY: Math.max(...ys) + marge
    }
  };
}
__name(genererPlateau, "genererPlateau");

// src/game/partie.ts
var COULEURS_PIONS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316"
];
var NOMS_EQUIPES = [
  "Les Rouges",
  "Les Bleus",
  "Les Verts",
  "Les Jaunes",
  "Les Violets",
  "Les Oranges"
];
function tirerEmplacementEtoile(plateau, pions, dejaPrises, interdits, rng) {
  const occupees = new Set(pions.map((p) => p.caseId));
  const libres = plateau.emplacementsEtoile.filter(
    (id) => !dejaPrises.includes(id) && !interdits.includes(id)
  );
  const candidats = libres.filter((id) => !occupees.has(id));
  const liste = candidats.length > 0 ? candidats : libres;
  if (liste.length === 0) return [null, rng];
  const [i, suivant] = tirerEntier(rng, 0, liste.length - 1);
  return [liste[i], suivant];
}
__name(tirerEmplacementEtoile, "tirerEmplacementEtoile");
function regarnirEtoiles(plateau, pions, etoilesSur, restantes, rng, interdits = []) {
  const cible = Math.min(REGLAGES.etoilesSurPlateau, restantes);
  let liste = [...etoilesSur];
  while (liste.length < cible) {
    const [emplacement, suivant] = tirerEmplacementEtoile(plateau, pions, liste, interdits, rng);
    rng = suivant;
    if (!emplacement) break;
    liste.push(emplacement);
  }
  if (liste.length > cible) liste = liste.slice(0, cible);
  return [liste, rng];
}
__name(regarnirEtoiles, "regarnirEtoiles");
function creerPartie(graine, definitions, mode = "multi") {
  if (definitions.length < REGLAGES.pionsMin || definitions.length > REGLAGES.pionsMax) {
    throw new Error(
      `Il faut entre ${REGLAGES.pionsMin} et ${REGLAGES.pionsMax} pions, re\xE7u ${definitions.length}.`
    );
  }
  const plateau = genererPlateau(graine);
  const pions = definitions.map((d, i) => ({
    id: `p${i}`,
    nom: d.nom,
    couleur: COULEURS_PIONS[i % COULEURS_PIONS.length],
    membres: d.membres,
    caseId: plateau.depart,
    pieces: REGLAGES.piecesDepart,
    etoiles: 0,
    gorgees: 0
  }));
  const [etoilesSur, rng] = regarnirEtoiles(
    plateau,
    pions,
    [],
    REGLAGES.etoilesParPartie,
    (graine ^ 2654435769) >>> 0
  );
  return {
    plateau,
    pions,
    ordreTour: pions.map((p) => p.id),
    indexTour: 0,
    manche: 1,
    phase: "lancer",
    mode,
    de: null,
    pasRestants: 0,
    choix: [],
    adversaireId: null,
    defiId: null,
    etoilesSur,
    etoilesRestantes: REGLAGES.etoilesParPartie,
    rng,
    journal: []
  };
}
__name(creerPartie, "creerPartie");
function pionActif(etat) {
  const id = etat.ordreTour[etat.indexTour];
  const pion = etat.pions.find((p) => p.id === id);
  if (!pion) throw new Error(`Pion actif introuvable : ${id}`);
  return pion;
}
__name(pionActif, "pionActif");
function noter(etat, texte, pionId) {
  return [...etat.journal, { manche: etat.manche, pionId: pionId ?? pionActif(etat).id, texte }];
}
__name(noter, "noter");
function majPion(etat, id, patch) {
  return etat.pions.map((p) => p.id === id ? { ...p, ...patch } : p);
}
__name(majPion, "majPion");
function majPionActif(etat, patch) {
  return majPion(etat, etat.ordreTour[etat.indexTour], patch);
}
__name(majPionActif, "majPionActif");
function donnerEtoile(etat, pionId, coutPieces, retiree) {
  const pions = majPion(etat, pionId, {
    etoiles: etat.pions.find((p) => p.id === pionId).etoiles + 1,
    pieces: etat.pions.find((p) => p.id === pionId).pieces - coutPieces
  });
  const etoilesRestantes = etat.etoilesRestantes - 1;
  const apresRetrait = retiree ? etat.etoilesSur.filter((id) => id !== retiree) : etat.etoilesSur;
  const [etoilesSur, rng] = regarnirEtoiles(
    etat.plateau,
    pions,
    apresRetrait,
    etoilesRestantes,
    etat.rng,
    // Même en dernier recours, l'étoile ne revient pas là où elle vient
    // d'être prise : le ramasseur est encore dessus.
    retiree ? [retiree] : []
  );
  return { ...etat, pions, etoilesRestantes, etoilesSur, rng };
}
__name(donnerEtoile, "donnerEtoile");
function suite(etat) {
  return etat.etoilesRestantes > 0 ? "finTour" : "terminee";
}
__name(suite, "suite");
function pionsSurCaseActive(etat) {
  const actif = pionActif(etat);
  return etat.pions.filter((p) => p.caseId === actif.caseId);
}
__name(pionsSurCaseActive, "pionsSurCaseActive");
function avancerSur(etat, caseId) {
  const pion = pionActif(etat);
  const passeParDepart = caseId === etat.plateau.depart;
  const pieces = pion.pieces + (passeParDepart ? REGLAGES.gainTourComplet : 0);
  const pasRestants = etat.pasRestants - 1;
  const pions = majPionActif(etat, { caseId, pieces });
  const journal = passeParDepart ? noter(etat, `passe par le d\xE9part, +${REGLAGES.gainTourComplet} pi\xE8ces`) : etat.journal;
  const enChemin = { ...etat, pions, pasRestants, choix: [], journal };
  if (pasRestants > 0) return { ...enChemin, phase: "deplacement" };
  const dejaLa = pions.some((p) => p.id !== pion.id && p.caseId === caseId);
  if (dejaLa) {
    const [defiId, rng] = tirerDefi("instantane", etat.mode, etat.rng);
    return { ...enChemin, phase: "defiInstantane", defiId, rng };
  }
  return { ...enChemin, phase: "resolution" };
}
__name(avancerSur, "avancerSur");
function reduire(etat, action) {
  switch (action.type) {
    case "LANCER_DE": {
      if (etat.phase !== "lancer") return etat;
      const [de, rng] = tirerEntier(etat.rng, REGLAGES.deMin, REGLAGES.deMax);
      return {
        ...etat,
        de,
        rng,
        pasRestants: de,
        phase: "deplacement",
        journal: noter(etat, `fait ${de}`)
      };
    }
    case "AVANCER": {
      if (etat.phase !== "deplacement" || etat.pasRestants <= 0) return etat;
      if (action.pasRestants !== etat.pasRestants) return etat;
      const courante = etat.plateau.cases[pionActif(etat).caseId];
      if (courante.suivantes.length > 1) {
        return { ...etat, phase: "croisement", choix: courante.suivantes };
      }
      return avancerSur(etat, courante.suivantes[0]);
    }
    case "CHOISIR_CHEMIN": {
      if (etat.phase !== "croisement" || !etat.choix.includes(action.caseId)) return etat;
      return avancerSur(etat, action.caseId);
    }
    case "RESOUDRE_CASE": {
      if (etat.phase !== "resolution") return etat;
      const pion = pionActif(etat);
      const caseCourante = etat.plateau.cases[pion.caseId];
      switch (caseCourante.type) {
        case "bonus": {
          const [gain, rng] = tirerEntier(etat.rng, REGLAGES.gainBonusMin, REGLAGES.gainBonusMax);
          return {
            ...etat,
            rng,
            pions: majPionActif(etat, { pieces: pion.pieces + gain }),
            phase: "finTour",
            journal: noter(etat, `case bonus, +${gain} pi\xE8ces`)
          };
        }
        case "malus":
          return { ...etat, phase: "choixMalus" };
        case "defi":
          return { ...etat, phase: "choixAdversaire" };
        case "boutique":
          return { ...etat, phase: "boutique" };
        case "etoile": {
          if (!etat.etoilesSur.includes(caseCourante.id)) {
            return {
              ...etat,
              phase: "finTour",
              journal: noter(etat, "emplacement d'\xE9toile, mais elle est ailleurs")
            };
          }
          const apres = donnerEtoile(etat, pion.id, 0, caseCourante.id);
          return {
            ...apres,
            phase: suite(apres),
            journal: noter(etat, "trouve une \xE9toile !")
          };
        }
        // Le contenu vient plus tard.
        case "evenement":
          return { ...etat, phase: "finTour", journal: noter(etat, "case \xE9v\xE9nement (\xE0 venir)") };
        default:
          return { ...etat, phase: "finTour" };
      }
    }
    case "CHOISIR_MALUS": {
      if (etat.phase !== "choixMalus") return etat;
      const pion = pionActif(etat);
      if (action.gage) {
        return { ...etat, phase: "finTour", journal: noter(etat, "pr\xE9f\xE8re le gage") };
      }
      return {
        ...etat,
        pions: majPionActif(etat, { pieces: Math.max(0, pion.pieces - REGLAGES.perteMalus) }),
        phase: "finTour",
        journal: noter(etat, `l\xE2che ${REGLAGES.perteMalus} pi\xE8ces`)
      };
    }
    case "ACHETER_ETOILE": {
      if (etat.phase !== "boutique") return etat;
      const pion = pionActif(etat);
      if (pion.pieces < REGLAGES.prixEtoileBoutique) return etat;
      const apres = donnerEtoile(etat, pion.id, REGLAGES.prixEtoileBoutique, null);
      return {
        ...apres,
        phase: suite(apres),
        journal: noter(etat, `ach\xE8te une \xE9toile pour ${REGLAGES.prixEtoileBoutique} pi\xE8ces`)
      };
    }
    case "ACHETER_GORGEES": {
      if (etat.phase !== "boutique") return etat;
      const pion = pionActif(etat);
      const cout = action.nombre * REGLAGES.prixGorgee;
      if (action.nombre <= 0 || pion.pieces < cout) return etat;
      return {
        ...etat,
        pions: majPionActif(etat, {
          pieces: pion.pieces - cout,
          gorgees: pion.gorgees + action.nombre
        }),
        journal: noter(etat, `ach\xE8te ${action.nombre} gorg\xE9es \xE0 distribuer`)
      };
    }
    case "QUITTER_BOUTIQUE": {
      if (etat.phase !== "boutique") return etat;
      return { ...etat, phase: "finTour" };
    }
    case "RESOUDRE_DEFI_INSTANTANE": {
      if (etat.phase !== "defiInstantane") return etat;
      const participants = pionsSurCaseActive(etat);
      const vainqueur = participants.find((p) => p.id === action.vainqueurId);
      if (!vainqueur) return etat;
      const perdants = participants.filter((p) => p.id !== vainqueur.id);
      return {
        ...etat,
        defiId: null,
        phase: "resolution",
        journal: noter(
          etat,
          `${vainqueur.nom} gagne le duel \xE9clair \u2014 ${perdants.map((p) => p.nom).join(", ")} boivent ${REGLAGES.gorgeesPerdantInstantane} gorg\xE9es`,
          vainqueur.id
        )
      };
    }
    case "CHOISIR_ADVERSAIRE": {
      if (etat.phase !== "choixAdversaire") return etat;
      const actif = pionActif(etat);
      if (action.pionId === actif.id || !etat.pions.some((p) => p.id === action.pionId)) {
        return etat;
      }
      const defie = etat.pions.find((p) => p.id === action.pionId);
      const [defiId, rng] = tirerDefi("duel", etat.mode, etat.rng);
      return {
        ...etat,
        adversaireId: action.pionId,
        defiId,
        rng,
        phase: "defiDuel",
        journal: noter(etat, `d\xE9fie ${defie.nom}`)
      };
    }
    case "RESOUDRE_DEFI": {
      if (etat.phase !== "defiDuel") return etat;
      const actif = pionActif(etat);
      if (action.vainqueurId !== actif.id && action.vainqueurId !== etat.adversaireId) return etat;
      const vainqueur = etat.pions.find((p) => p.id === action.vainqueurId);
      return {
        ...etat,
        pions: majPion(etat, action.vainqueurId, {
          pieces: vainqueur.pieces + REGLAGES.gainDefiDuel
        }),
        adversaireId: null,
        defiId: null,
        phase: "finTour",
        journal: noter(
          etat,
          `${vainqueur.nom} remporte le duel, +${REGLAGES.gainDefiDuel} pi\xE8ces`
        )
      };
    }
    case "DONNER_GORGEE": {
      if (etat.phase === "terminee") return etat;
      const donneur = etat.pions.find((p) => p.id === action.donneurId);
      const receveur = etat.pions.find((p) => p.id === action.receveurId);
      if (!donneur || !receveur || donneur.gorgees <= 0) return etat;
      return {
        ...etat,
        pions: majPion(etat, donneur.id, { gorgees: donneur.gorgees - 1 }),
        journal: noter(etat, `offre une gorg\xE9e \xE0 ${receveur.nom}`, donneur.id)
      };
    }
    case "FIN_TOUR": {
      if (etat.phase !== "finTour") return etat;
      const indexTour = (etat.indexTour + 1) % etat.ordreTour.length;
      const [etoilesSur, rngApres] = regarnirEtoiles(
        etat.plateau,
        etat.pions,
        etat.etoilesSur,
        etat.etoilesRestantes,
        etat.rng
      );
      const finDeManche = indexTour === 0;
      const [defiId, rng] = finDeManche ? tirerDefi("collectif", etat.mode, rngApres) : [null, rngApres];
      return {
        ...etat,
        indexTour,
        etoilesSur,
        rng,
        defiId,
        phase: finDeManche ? "defiCollectif" : "lancer",
        de: null,
        pasRestants: 0,
        choix: []
      };
    }
    case "RESOUDRE_DEFI_COLLECTIF": {
      if (etat.phase !== "defiCollectif") return etat;
      const vainqueur = etat.pions.find((p) => p.id === action.vainqueurId);
      if (!vainqueur) return etat;
      const apres = donnerEtoile(etat, vainqueur.id, 0, null);
      return {
        ...apres,
        manche: etat.manche + 1,
        indexTour: 0,
        de: null,
        pasRestants: 0,
        defiId: null,
        phase: apres.etoilesRestantes > 0 ? "lancer" : "terminee",
        journal: noter(etat, `remporte le d\xE9fi de fin de manche et une \xE9toile`, vainqueur.id)
      };
    }
    default:
      return etat;
  }
}
__name(reduire, "reduire");

// worker/index.ts
var Partie = class extends Server {
  static {
    __name(this, "Partie");
  }
  static options = { hibernate: true };
  salon = { code: "", hoteId: null, joueurs: [], nbEquipes: 4 };
  partie = null;
  async onStart() {
    const sauvegarde = await this.ctx.storage.get("partie");
    if (sauvegarde) {
      this.salon = sauvegarde.salon;
      this.partie = sauvegarde.partie;
    }
    this.salon.code = this.name;
  }
  async sauver() {
    await this.ctx.storage.put("partie", {
      salon: this.salon,
      partie: this.partie
    });
  }
  diffuser() {
    for (const conn of this.getConnections()) {
      const message = {
        type: "etat",
        salon: this.salon,
        partie: this.partie,
        toiId: conn.id
      };
      conn.send(JSON.stringify(message));
    }
  }
  /** L'équipe la moins fournie, pour que les nouveaux se répartissent seuls. */
  equipeLaPlusVide() {
    const effectifs = Array.from(
      { length: this.salon.nbEquipes },
      (_, i) => this.salon.joueurs.filter((j) => j.equipe === i).length
    );
    return effectifs.indexOf(Math.min(...effectifs));
  }
  estHote(conn) {
    return this.salon.hoteId === conn.id;
  }
  onConnect(conn) {
    const connu = this.salon.joueurs.find((j) => j.id === conn.id);
    if (connu) connu.connecte = true;
    this.diffuser();
  }
  onClose(conn) {
    const joueur = this.salon.joueurs.find((j) => j.id === conn.id);
    if (!joueur) return;
    if (this.partie) {
      joueur.connecte = false;
    } else {
      this.salon.joueurs = this.salon.joueurs.filter((j) => j.id !== conn.id);
      if (this.salon.hoteId === conn.id) {
        this.salon.hoteId = this.salon.joueurs[0]?.id ?? null;
      }
    }
    void this.sauver();
    this.diffuser();
  }
  async onMessage(conn, brut) {
    if (typeof brut !== "string") return;
    let message;
    try {
      message = JSON.parse(brut);
    } catch {
      return this.repondreErreur(conn, "Message illisible.");
    }
    switch (message.type) {
      case "rejoindre": {
        if (this.partie) return this.repondreErreur(conn, "La partie a d\xE9j\xE0 commenc\xE9.");
        if (this.salon.joueurs.some((j) => j.id === conn.id)) break;
        const nom = message.nom.trim().slice(0, 16) || "Sans nom";
        const joueur = {
          id: conn.id,
          nom,
          equipe: this.equipeLaPlusVide(),
          connecte: true
        };
        this.salon.joueurs.push(joueur);
        this.salon.hoteId ??= conn.id;
        break;
      }
      case "reglerEquipes": {
        if (!this.estHote(conn)) return this.repondreErreur(conn, "Seul l'h\xF4te r\xE8gle les \xE9quipes.");
        if (this.partie) break;
        const n = Math.round(message.nbEquipes);
        if (n < REGLAGES.pionsMin || n > REGLAGES.pionsMax) break;
        this.salon.nbEquipes = n;
        for (const j of this.salon.joueurs) {
          if (j.equipe >= n) j.equipe = this.equipeLaPlusVide();
        }
        break;
      }
      case "changerEquipe": {
        if (this.partie) break;
        const cible = this.salon.joueurs.find((j) => j.id === message.joueurId);
        if (!cible || cible.id !== conn.id && !this.estHote(conn)) break;
        if (message.equipe < 0 || message.equipe >= this.salon.nbEquipes) break;
        cible.equipe = message.equipe;
        break;
      }
      case "demarrer": {
        if (!this.estHote(conn)) return this.repondreErreur(conn, "Seul l'h\xF4te lance la partie.");
        if (this.partie) break;
        const equipes = this.equipes();
        const vides = equipes.filter((e) => e.membres.length === 0);
        if (vides.length > 0) {
          return this.repondreErreur(
            conn,
            "Chaque \xE9quipe doit avoir au moins un joueur pour d\xE9marrer."
          );
        }
        this.partie = creerPartie(graineAleatoire(), equipes, "multi");
        break;
      }
      case "action": {
        if (!this.partie) break;
        this.partie = reduire(this.partie, message.action);
        break;
      }
      case "rejouer": {
        if (!this.estHote(conn)) return this.repondreErreur(conn, "Seul l'h\xF4te relance.");
        this.partie = null;
        break;
      }
    }
    await this.sauver();
    this.diffuser();
  }
  /**
   * Les équipes dans l'ordre, vides comprises.
   *
   * On ne filtre surtout pas les vides : l'index de l'équipe est aussi celui de
   * son pion, et un décalage ferait piloter à un joueur l'équipe du voisin.
   * C'est le démarrage qui refuse les équipes vides.
   */
  equipes() {
    return Array.from({ length: this.salon.nbEquipes }, (_, i) => ({
      nom: NOMS_EQUIPES[i],
      membres: this.salon.joueurs.filter((j) => j.equipe === i).map((j) => j.nom)
    }));
  }
  repondreErreur(conn, message) {
    conn.send(JSON.stringify({ type: "erreur", message }));
  }
};
var worker_default = {
  async fetch(request, env2) {
    return await routePartykitRequest(request, env2) ?? new Response("Not Found", { status: 404 });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-brEnB3/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-brEnB3/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  Partie,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
