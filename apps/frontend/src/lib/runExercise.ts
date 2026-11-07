export interface TestCase { args: unknown[]; expected: unknown }
export interface TestResult { ok: boolean; got?: string; error?: string }

/** Runs the learner's function against the tests in a Web Worker, so a loop or a crash cannot freeze the page. */
export function runExercise(code: string, fn: string, tests: TestCase[], timeoutMs = 3000): Promise<{ results: TestResult[] } | { error: string }> {
  const source = `
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    self.onmessage = (e) => {
      const { code, fn, tests } = e.data;
      let f;
      try { f = new Function(code + '\\nreturn typeof ' + fn + ' === "function" ? ' + fn + ' : undefined;')(); } catch (err) { self.postMessage({ error: String(err) }); return; }
      if (!f) { self.postMessage({ error: 'Define a function named ' + fn + '.' }); return; }
      const results = tests.map((t) => {
        try { const got = f(...JSON.parse(JSON.stringify(t.args))); return { ok: same(got, t.expected), got: JSON.stringify(got) }; }
        catch (err) { return { ok: false, error: String(err) }; }
      });
      self.postMessage({ results });
    };`;
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url);
  return new Promise((resolve) => {
    const done = (v: { results: TestResult[] } | { error: string }) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(v); };
    const timer = setTimeout(() => done({ error: "timeout" }), timeoutMs);
    worker.onmessage = (e) => done(e.data);
    worker.onerror = (e) => done({ error: e.message || "error" });
    worker.postMessage({ code, fn, tests });
  });
}
