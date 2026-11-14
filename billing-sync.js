// A transaction from another signed-in app account must not block this account's restore.
export async function syncTransactions(rows, verify, refresh) {
  const failures = [];
  try {
    for (const row of rows || []) {
      try { await verify(row.signedTransaction); }
      catch (error) { failures.push(error); }
    }
  } finally { await refresh(); }
  return failures;
}
