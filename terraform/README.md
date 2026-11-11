# Create the examples' app with Terraform

Instead of clicking through the portal, create one Hibira app for every
example here with the
[Hibira Terraform provider](https://registry.terraform.io/providers/hibira-io/hibira/latest),
then write each example's `.env` from Terraform's outputs.

| File | What |
|------|------|
| `main.tf` | `hibira_app` with client events on, and `hibira_push` when `push = true` |
| `variables.tf` | The app's name, allowed origins and the optional Apple / Firebase push credentials |
| `outputs.tf` | Ready-made `.env` contents for each kind of example |
| `tests/` | `terraform test` with a mock provider, no account needed |

## Run it

1. In the [portal](https://hibira.io/portal), API tokens page, make a token
   with read and write access.
2. Create the app:

   ```sh
   cd terraform
   export HIBIRA_API_TOKEN=hkb_pat_...
   terraform init
   terraform apply
   ```

   To change the name, add allowed origins or turn on push, copy
   `terraform.tfvars.example` to `terraform.tfvars` first.
3. Write the `.env` file of the example you want:

   ```sh
   terraform output -raw nextjs_env > ../nextjs-lobby/.env.local   # any nextjs-* example
   terraform output -raw vite_env   > ../phaser-lobby/.env.local
   terraform output -raw push_env   > ../react-native-push/.env     # with push = true
   terraform output -raw laravel_env  # paste over the HIBIRA_* lines of a Laravel example's .env
   ```

The secret only lives in your local `terraform.tfstate` and the `.env`
files, which are all git-ignored. `terraform destroy` deletes the app.

## Push

Set `push = true` for react-native-push and the push part of
laravel-ai-approvals. Add `apns_*` (a .p8 key) for iOS and
`fcm_service_account_path` for Android; with neither, only web push works.
The APNs key is set to the `development` environment, which is what Expo
development builds use.

## Hosted copies

`allowed_origins` is empty, which lets any origin connect. That's fine on
localhost; before you deploy a copy to Vercel, Netlify or elsewhere, list
its address there and apply again.

## 中文摘要

用 Terraform 建立所有範例共用的 Hibira App（開啟 client events，可選擇開啟推送），
再用 `terraform output -raw <名稱>_env` 產生各範例的 `.env`。需要一個有讀寫權限的
API token（`HIBIRA_API_TOKEN`）。部署到公開網址前，請在 `allowed_origins` 填入網址。
