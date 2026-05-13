type NoopQueryMode = "list" | "single"

function createNoopQuery(initialMode: NoopQueryMode = "list") {
  let mode = initialMode

  const resolveResult = () =>
    mode === "single"
      ? { data: null, error: null }
      : { data: [], error: null }

  const query: any = {}

  const chainableMethods = [
    "select",
    "order",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "in",
    "contains",
    "overlaps",
    "range",
    "rangeGt",
    "rangeGte",
    "rangeLt",
    "rangeLte",
    "or",
    "match",
    "filter",
    "limit",
    "offset",
    "rangeAscending",
    "rangeDescending",
    "not",
  ]

  chainableMethods.forEach((method) => {
    query[method] = () => query
  })

  query.single = () => {
    mode = "single"
    return query
  }

  query.maybeSingle = () => {
    mode = "single"
    return query
  }

  query.insert = () => {
    mode = "single"
    return query
  }

  query.update = () => {
    mode = "single"
    return query
  }

  query.upsert = () => {
    mode = "single"
    return query
  }

  query.delete = () => {
    mode = "single"
    return query
  }

  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolveResult()).then(onFulfilled, onRejected)

  query.catch = (onRejected: any) => Promise.resolve(resolveResult()).catch(onRejected)

  query.finally = (onFinally: any) => Promise.resolve(resolveResult()).finally(onFinally)

  return query
}

function createNoopAuth() {
  return new Proxy(
    {},
    {
      get(_, property) {
        if (property === "getUser") {
          return async () => ({ data: { user: null }, error: null })
        }

        if (property === "getSession") {
          return async () => ({ data: { session: null }, error: null })
        }

        if (property === "onAuthStateChange") {
          return () => ({
            data: {
              subscription: {
                unsubscribe() {},
              },
            },
            error: null,
          })
        }

        return async () => ({ data: null, error: null })
      },
    },
  )
}

function createNoopStorage() {
  return new Proxy(
    {},
    {
      get() {
        return () => createNoopQuery()
      },
    },
  )
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export function createNoopSupabaseClient() {
  return {
    from: () => createNoopQuery(),
    auth: createNoopAuth(),
    storage: createNoopStorage(),
    rpc: async () => ({ data: null, error: null }),
  } as any
}