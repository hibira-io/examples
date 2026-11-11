mock_provider "hibira" {
  mock_resource "hibira_app" {
    defaults = {
      id     = "app_test"
      key    = "key_test"
      secret = "secret_test"
      host   = "ws.hibira.io"
    }
  }
  mock_resource "hibira_push" {
    defaults = {
      instance_id = "inst_test"
      endpoint    = "https://ws.hibira.io"
      secret_key  = "push_secret_test"
    }
  }
}

run "realtime_only" {
  command = apply

  assert {
    condition     = hibira_app.examples.client_events
    error_message = "The lobby, games and handoff examples need client events."
  }
  assert {
    condition     = length(hibira_push.examples) == 0 && output.push_env == ""
    error_message = "Push stays off unless push = true."
  }
  assert {
    condition     = strcontains(output.nextjs_env, "HIBIRA_APP_SECRET=secret_test") && strcontains(output.nextjs_env, "NEXT_PUBLIC_HIBIRA_APP_KEY=key_test")
    error_message = "nextjs_env must hold the app's credentials."
  }
}

run "with_push" {
  command = apply

  variables {
    push = true
  }

  assert {
    condition     = length(hibira_push.examples) == 1 && hibira_push.examples[0].apns == null && hibira_push.examples[0].fcm == null
    error_message = "Push without Apple or Firebase files sets no credentials."
  }
  assert {
    condition     = strcontains(output.push_env, "EXPO_PUBLIC_HIBIRA_PUSH_INSTANCE_ID=inst_test") && strcontains(output.laravel_env, "HIBIRA_PUSH_SECRET_KEY=push_secret_test")
    error_message = "push_env and laravel_env must carry the push instance."
  }
}
