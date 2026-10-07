// src/game/caza/lua51.ts
var LuaTable = class _LuaTable {
  hash = /* @__PURE__ */ new Map();
  meta = null;
  get(k) {
    const v = this.hash.get(k);
    if (v !== void 0) return v;
    if (this.meta) {
      const idx = this.meta.hash.get("__index");
      if (idx instanceof _LuaTable) return idx.get(k);
      if (idx) return first(callFn(idx, [this, k]));
    }
    return null;
  }
  set(k, v) {
    if (this.meta && !this.hash.has(k)) {
      const ni = this.meta.hash.get("__newindex");
      if (ni instanceof _LuaTable) {
        ni.set(k, v);
        return;
      }
      if (ni) {
        callFn(ni, [this, k, v]);
        return;
      }
    }
    if (v === null) this.hash.delete(k);
    else this.hash.set(k, v);
  }
  length() {
    let n = 0;
    while (this.hash.has(n + 1)) n++;
    return n;
  }
};
var Upval = class {
  constructor(arr, idx) {
    this.arr = arr;
    this.idx = idx;
  }
  arr;
  idx;
  get() {
    return this.arr[this.idx];
  }
  set(v) {
    this.arr[this.idx] = v;
  }
};
var LuaClosure = class {
  constructor(p, ups) {
    this.p = p;
    this.ups = ups;
  }
  p;
  ups;
};
function first(r) {
  if (Array.isArray(r)) return r.length ? r[0] : null;
  return r === void 0 ? null : r;
}
function toArr(r) {
  if (Array.isArray(r)) return r;
  return r === void 0 ? [] : [r];
}
function load(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] !== 27 || b[1] !== 76 || b[4] !== 81) throw new Error("not Lua 5.1 bytecode");
  let p = 12;
  const u32 = () => {
    const v = dv.getUint32(p, true);
    p += 4;
    return v;
  };
  const str = () => {
    const n = u32();
    if (n === 0) return null;
    let s = "";
    for (let i = 0; i < n - 1; i++) s += String.fromCharCode(b[p + i]);
    p += n;
    return s;
  };
  const dec = (s) => new TextDecoder("windows-1252").decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  const fn = () => {
    const source = str() ?? "";
    u32();
    u32();
    const nups = b[p++];
    const nparams = b[p++];
    const vararg = b[p++] !== 0;
    const maxstack = b[p++];
    const nc = u32();
    const code = new Uint32Array(nc);
    for (let i = 0; i < nc; i++) code[i] = u32();
    const nk = u32();
    const k = [];
    for (let i = 0; i < nk; i++) {
      const t = b[p++];
      if (t === 0) k.push(null);
      else if (t === 1) k.push(b[p++] !== 0);
      else if (t === 3) {
        k.push(dv.getFloat64(p, true));
        p += 8;
      } else k.push(dec(str() ?? ""));
    }
    const np = u32();
    const protos = [];
    for (let i = 0; i < np; i++) protos.push(fn());
    for (let n = u32(); n > 0; n--) u32();
    for (let n = u32(); n > 0; n--) {
      str();
      u32();
      u32();
    }
    for (let n = u32(); n > 0; n--) str();
    return { source, nparams, vararg, maxstack, code, k, protos, nups };
  };
  return fn();
}
var LuaError = class extends Error {
};
var G = new LuaTable();
function setGlobals(g) {
  G = g;
}
function globals() {
  return G;
}
function callFn(f, args) {
  if (typeof f === "function") return toArr(f(...args));
  if (f instanceof LuaClosure) return run(f, args);
  throw new LuaError("attempt to call a non-function value");
}
function call(f, ...args) {
  if (typeof f === "function" || f instanceof LuaClosure) return callFn(f, args);
  throw new LuaError("attempt to call a " + typeName(f) + " value");
}
function typeName(v) {
  if (v === null) return "nil";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (v instanceof LuaTable) return "table";
  return "function";
}
var truthy = (v) => v !== null && v !== false;
function num(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  throw new LuaError("attempt to perform arithmetic on a " + typeName(v) + " value");
}
function tostr(v) {
  if (v === null) return "nil";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(14)));
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return v;
  return typeName(v) + ": 0x0";
}
function index(o, k) {
  if (o instanceof LuaTable) return o.get(k);
  if (typeof o === "string") {
    const s = G.get("string");
    return s instanceof LuaTable ? s.get(k) : null;
  }
  throw new LuaError("attempt to index a " + typeName(o) + " value");
}
function eq(a, b) {
  return a === b;
}
function lt(a, b) {
  if (typeof a === "number" && typeof b === "number") return a < b;
  if (typeof a === "string" && typeof b === "string") return a < b;
  throw new LuaError("attempt to compare " + typeName(a) + " with " + typeName(b));
}
function le(a, b) {
  if (typeof a === "number" && typeof b === "number") return a <= b;
  if (typeof a === "string" && typeof b === "string") return a <= b;
  throw new LuaError("attempt to compare " + typeName(a) + " with " + typeName(b));
}
function run(cl, args) {
  const p = cl.p;
  const R = new Array(Math.max(p.maxstack, 2) + 1).fill(null);
  let varargs = [];
  for (let i = 0; i < p.nparams; i++) R[i] = args[i] ?? null;
  if (p.vararg) varargs = args.slice(p.nparams);
  const open = [];
  const code = p.code, K = p.k;
  const RK = (x) => x >= 256 ? K[x - 256] : R[x];
  let pc = 0;
  let top = 0;
  for (; ; ) {
    const i = code[pc++];
    const op = i & 63, A = i >>> 6 & 255, C = i >>> 14 & 511, B = i >>> 23 & 511, Bx = i >>> 14, sBx = Bx - 131071;
    switch (op) {
      case 0:
        R[A] = R[B];
        break;
      case 1:
        R[A] = K[Bx];
        break;
      case 2:
        R[A] = B !== 0;
        if (C) pc++;
        break;
      case 3:
        for (let r = A; r <= B; r++) R[r] = null;
        break;
      case 4:
        R[A] = cl.ups[B].get();
        break;
      case 5:
        R[A] = G.get(K[Bx]);
        break;
      case 6:
        R[A] = index(R[B], RK(C));
        break;
      case 7:
        G.set(K[Bx], R[A]);
        break;
      case 8:
        cl.ups[B].set(R[A]);
        break;
      case 9: {
        const t = R[A];
        if (!(t instanceof LuaTable)) throw new LuaError("attempt to index a " + typeName(t) + " value");
        t.set(RK(B), RK(C));
        break;
      }
      case 10:
        R[A] = new LuaTable();
        break;
      case 11: {
        const o = R[B];
        R[A + 1] = o;
        R[A] = index(o, RK(C));
        break;
      }
      case 12:
        R[A] = num(RK(B)) + num(RK(C));
        break;
      case 13:
        R[A] = num(RK(B)) - num(RK(C));
        break;
      case 14:
        R[A] = num(RK(B)) * num(RK(C));
        break;
      case 15:
        R[A] = num(RK(B)) / num(RK(C));
        break;
      case 16: {
        const a = num(RK(B)), b = num(RK(C));
        R[A] = a - Math.floor(a / b) * b;
        break;
      }
      case 17:
        R[A] = Math.pow(num(RK(B)), num(RK(C)));
        break;
      case 18:
        R[A] = -num(R[B]);
        break;
      case 19:
        R[A] = !truthy(R[B]);
        break;
      case 20: {
        const v = R[B];
        R[A] = typeof v === "string" ? v.length : v instanceof LuaTable ? v.length() : 0;
        break;
      }
      case 21: {
        let s = "";
        for (let r = B; r <= C; r++) {
          const v = R[r];
          if (typeof v !== "string" && typeof v !== "number") throw new LuaError("attempt to concatenate a " + typeName(v) + " value");
          s += tostr(v);
        }
        R[A] = s;
        break;
      }
      case 22:
        pc += sBx;
        break;
      case 23:
        if (eq(RK(B), RK(C)) !== (A !== 0)) pc++;
        break;
      case 24:
        if (lt(RK(B), RK(C)) !== (A !== 0)) pc++;
        break;
      case 25:
        if (le(RK(B), RK(C)) !== (A !== 0)) pc++;
        break;
      case 26:
        if (truthy(R[A]) === (C !== 0)) {
        } else pc++;
        break;
      case 27:
        if (truthy(R[B]) === (C !== 0)) R[A] = R[B];
        else pc++;
        break;
      case 28:
      case 29: {
        const f = R[A];
        let n = B === 0 ? top - A - 1 : B - 1;
        const a = [];
        for (let r = 0; r < n; r++) a.push(R[A + 1 + r]);
        let res;
        if (typeof f === "function") res = toArr(f(...a));
        else if (f instanceof LuaClosure) res = run(f, a);
        else if (f instanceof LuaTable && f.meta && f.meta.hash.get("__call")) res = callFn(f.meta.hash.get("__call"), [f, ...a]);
        else throw new LuaError("attempt to call a " + typeName(f) + " value");
        if (op === 29) return res;
        if (C === 0) {
          for (let r = 0; r < res.length; r++) R[A + r] = res[r];
          top = A + res.length;
        } else for (let r = 0; r < C - 1; r++) R[A + r] = res[r] ?? null;
        break;
      }
      case 30: {
        const n = B === 0 ? top - A : B - 1;
        const out = [];
        for (let r = 0; r < n; r++) out.push(R[A + r]);
        return out;
      }
      case 31: {
        const step = num(R[A + 2]);
        const v = num(R[A]) + step;
        const lim = num(R[A + 1]);
        if (step > 0 ? v <= lim : v >= lim) {
          R[A] = v;
          R[A + 3] = v;
          pc += sBx;
        }
        break;
      }
      case 32:
        R[A] = num(R[A]) - num(R[A + 2]);
        pc += sBx;
        break;
      case 33: {
        const f = R[A + 0];
        const res = callFn(f, [R[A + 1], R[A + 2]]);
        for (let r = 0; r < C; r++) R[A + 3 + r] = res[r] ?? null;
        if (R[A + 3] !== null) R[A + 2] = R[A + 3];
        else pc++;
        break;
      }
      case 34: {
        const n = B === 0 ? top - A - 1 : B;
        const t = R[A];
        const base = C === 0 ? code[pc++] : C;
        for (let r = 1; r <= n; r++) t.set((base - 1) * 50 + r, R[A + r]);
        break;
      }
      case 35:
        for (let u = open.length - 1; u >= 0; u--) {
          const uv = open[u];
          if (uv.arr === R && uv.idx >= A) {
            uv.arr = [R[uv.idx]];
            uv.idx = 0;
            open.splice(u, 1);
          }
        }
        break;
      case 36: {
        const sub = p.protos[Bx];
        const ups = [];
        for (let u = 0; u < sub.nups; u++) {
          const pseudo = code[pc++];
          const pop = pseudo & 63, pb = pseudo >>> 23 & 511;
          if (pop === 0) {
            const uv = new Upval(R, pb);
            open.push(uv);
            ups.push(uv);
          } else ups.push(cl.ups[pb]);
        }
        R[A] = new LuaClosure(sub, ups);
        break;
      }
      case 37: {
        const n = B === 0 ? varargs.length : B - 1;
        for (let r = 0; r < n; r++) R[A + r] = varargs[r] ?? null;
        if (B === 0) top = A + n;
        break;
      }
      default:
        throw new LuaError("bad opcode " + op);
    }
  }
}
function closureOf(p) {
  return new LuaClosure(p, []);
}
function stdlib(g) {
  const T = (o) => {
    const t = new LuaTable();
    for (const [k, v] of Object.entries(o)) t.set(k, v);
    return t;
  };
  g.set("_G", g);
  g.set("print", (...a) => {
    console.log("[lua]", a.map(tostr).join("	"));
  });
  g.set("tostring", (v = null) => tostr(v));
  g.set("tonumber", (v = null) => {
    if (typeof v === "number") return v;
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  });
  g.set("type", (v = null) => typeName(v));
  g.set("ipairs", (t) => {
    const it = (tt, i) => {
      const n = i + 1;
      const v = tt.get(n);
      return v === null ? [null] : [n, v];
    };
    return [it, t, 0];
  });
  g.set("pairs", (t) => {
    const keys = [...t.hash.keys()];
    let idx = 0;
    const it = () => {
      while (idx < keys.length) {
        const k = keys[idx++];
        const v = t.hash.get(k);
        if (v !== void 0) return [k, v];
      }
      return [null];
    };
    return [it, t, null];
  });
  g.set("setmetatable", (t, m) => {
    t.meta = m;
    return t;
  });
  g.set("getmetatable", (t) => t.meta);
  g.set("rawget", (t, k) => t.hash.get(k) ?? null);
  g.set("rawset", (t, k, v) => {
    t.hash.set(k, v);
    return t;
  });
  g.set("select", (n, ...a) => n === "#" ? a.length : a.slice(n - 1));
  g.set("unpack", (t) => {
    const out = [];
    const tt = t;
    for (let i = 1; i <= tt.length(); i++) out.push(tt.get(i));
    return out;
  });
  g.set("assert", (v, m) => {
    if (!truthy(v ?? null)) throw new LuaError(String(m ?? "assertion failed!"));
    return v ?? null;
  });
  g.set("error", (m) => {
    throw new LuaError(tostr(m ?? null));
  });
  g.set("pcall", (f, ...a) => {
    try {
      return [true, ...callFn(f, a)];
    } catch (e) {
      return [false, String(e)];
    }
  });
  g.set("math", T({
    random: (a, b) => a === void 0 ? Math.random() : b === void 0 ? Math.floor(Math.random() * a) + 1 : Math.floor(Math.random() * (b - a + 1)) + a,
    randomseed: () => void 0,
    floor: (x) => Math.floor(x),
    ceil: (x) => Math.ceil(x),
    abs: (x) => Math.abs(x),
    max: (...a) => Math.max(...a),
    min: (...a) => Math.min(...a),
    sqrt: (x) => Math.sqrt(x),
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    pow: (a, b) => Math.pow(a, b)
  }));
  g.set("string", T({
    sub: (s, i, j) => {
      const str = String(s);
      const n = str.length;
      let a = i ?? 1;
      let b = j ?? -1;
      if (a < 0) a = Math.max(n + a + 1, 1);
      if (b < 0) b = n + b + 1;
      if (a < 1) a = 1;
      return str.substring(a - 1, Math.min(b, n));
    },
    upper: (s) => String(s).toUpperCase(),
    lower: (s) => String(s).toLowerCase(),
    len: (s) => String(s).length,
    rep: (s, n) => String(s).repeat(Math.max(0, n)),
    find: (s, pat, init, plain) => {
      const str = String(s);
      const at = Math.max(0, (init ?? 1) - 1);
      const i = str.indexOf(String(pat), at);
      return i < 0 ? null : [i + 1, i + String(pat).length];
    },
    match: (s, pat) => {
      const m = new RegExp(String(pat).replace(/%a/g, "[A-Za-z]").replace(/%d/g, "\\d").replace(/%s/g, "\\s").replace(/%w/g, "\\w").replace(/%%/g, "%")).exec(String(s));
      return m ? m.length > 1 ? m.slice(1) : m[0] : null;
    },
    format: (f, ...a) => {
      let k = 0;
      return String(f).replace(/%(\d*)(?:\.(\d+))?([dsf%])/g, (_m, w, pr, t) => t === "%" ? "%" : t === "d" ? String(Math.floor(a[k++])) : t === "f" ? a[k++].toFixed(pr ? +pr : 6) : tostr(a[k++] ?? null));
    }
  }));
  g.set("table", T({
    insert: (t, a, b) => {
      const tt = t;
      const n = tt.length();
      if (b === void 0) tt.set(n + 1, a);
      else {
        for (let i = n; i >= a; i--) tt.set(i + 1, tt.get(i));
        tt.set(a, b);
      }
    },
    remove: (t, pos) => {
      const tt = t;
      const n = tt.length();
      const p = pos ?? n;
      const v = tt.get(p);
      for (let i = p; i < n; i++) tt.set(i, tt.get(i + 1));
      tt.set(n, null);
      return v;
    },
    getn: (t) => t.length(),
    concat: (t, sep) => {
      const tt = t;
      const out = [];
      for (let i = 1; i <= tt.length(); i++) out.push(tostr(tt.get(i)));
      return out.join(String(sep ?? ""));
    }
  }));
  g.set("os", T({ time: () => Math.floor(Date.now() / 1e3), clock: () => performance.now() / 1e3, date: () => "" }));
}
export {
  LuaClosure,
  LuaError,
  LuaTable,
  call,
  callFn,
  closureOf,
  globals,
  load,
  setGlobals,
  stdlib,
  tostr,
  typeName
};
