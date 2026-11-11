# One app for every example in this repository. Client events are on, since
# the lobby, games and handoff examples send client- events between browsers.
resource "hibira_app" "examples" {
  name            = var.name
  client_events   = true
  allowed_origins = var.allowed_origins
}

# Push notifications, for react-native-push and laravel-ai-approvals. Off
# unless push = true. Apple and Firebase credentials are optional: without
# them the instance accepts web push only.
resource "hibira_push" "examples" {
  count  = var.push ? 1 : 0
  app_id = hibira_app.examples.id

  apns = var.apns_key_path == null ? null : {
    key_id      = var.apns_key_id
    team_id     = var.apns_team_id
    bundle_id   = var.apns_bundle_id
    environment = "development"
    private_key = file(var.apns_key_path)
  }

  fcm = var.fcm_service_account_path == null ? null : {
    service_account = file(var.fcm_service_account_path)
  }
}

locals {
  push = var.push ? hibira_push.examples[0] : null
}
