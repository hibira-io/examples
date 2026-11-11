output "app_id" {
  value = hibira_app.examples.id
}

output "key" {
  value = hibira_app.examples.key
}

output "host" {
  value = hibira_app.examples.host
}

# terraform output -raw nextjs_env > ../nextjs-lobby/.env.local
# (also nextjs-dashboard, nextjs-games, nextjs-handoff, nextjs-spaces)
output "nextjs_env" {
  sensitive = true
  value     = <<-EOT
    HIBIRA_APP_ID=${hibira_app.examples.id}
    HIBIRA_APP_SECRET=${hibira_app.examples.secret}
    NEXT_PUBLIC_HIBIRA_APP_KEY=${hibira_app.examples.key}
    NEXT_PUBLIC_HIBIRA_HOST=${hibira_app.examples.host}
  EOT
}

# terraform output -raw vite_env > ../phaser-lobby/.env.local
output "vite_env" {
  value = <<-EOT
    VITE_HIBIRA_APP_KEY=${hibira_app.examples.key}
    VITE_HIBIRA_HOST=${hibira_app.examples.host}
  EOT
}

# The HIBIRA_* lines of laravel-chat's and laravel-ai-approvals' .env.
# Paste them over the empty ones; the rest of .env comes from .env.example.
output "laravel_env" {
  sensitive = true
  value = join("\n", compact([
    "HIBIRA_APP_ID=${hibira_app.examples.id}",
    "HIBIRA_APP_KEY=${hibira_app.examples.key}",
    "HIBIRA_APP_SECRET=${hibira_app.examples.secret}",
    "HIBIRA_HOST=${hibira_app.examples.host}",
    local.push == null ? "" : "HIBIRA_PUSH_INSTANCE_ID=${local.push.instance_id}",
    local.push == null ? "" : "HIBIRA_PUSH_SECRET_KEY=${local.push.secret_key}",
  ]))
}

# terraform output -raw push_env > ../react-native-push/.env  (needs push = true)
output "push_env" {
  sensitive = true
  value     = local.push == null ? "" : <<-EOT
    EXPO_PUBLIC_HIBIRA_PUSH_INSTANCE_ID=${local.push.instance_id}
    EXPO_PUBLIC_HIBIRA_PUSH_ENDPOINT=${local.push.endpoint}
    HIBIRA_PUSH_SECRET_KEY=${local.push.secret_key}
  EOT
}
