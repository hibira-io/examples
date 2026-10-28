export default function Setup() {
  return (
    <main className="page">
      <h1>Connect your Hibira app</h1>
      <p>
        These games need an app on <a href="https://hibira.io/portal">hibira.io</a>. The free plan is enough and
        needs no card.
      </p>
      <ol>
        <li>Create an app in the portal, open its page and turn on <strong>Allow client events</strong> in its settings.</li>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in the app ID, key and secret.
        </li>
        <li>Restart the dev server and reload this page.</li>
      </ol>
      <pre>{`HIBIRA_APP_ID=your-app-id
HIBIRA_APP_SECRET=your-app-secret
NEXT_PUBLIC_HIBIRA_APP_KEY=your-app-key
NEXT_PUBLIC_HIBIRA_HOST=ws.hibira.io`}</pre>
    </main>
  );
}
