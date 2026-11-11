variable "name" {
  description = "The app's name in the portal."
  type        = string
  default     = "hibira-examples"
}

variable "allowed_origins" {
  description = "Web origins that may connect, such as https://my-demo.vercel.app. Empty allows any origin, which is fine on localhost; set it before you share a hosted copy."
  type        = list(string)
  default     = []
}

variable "push" {
  description = "Turn on push notifications (react-native-push, laravel-ai-approvals)."
  type        = bool
  default     = false
}

variable "apns_key_path" {
  description = "Path to an APNs .p8 key, for iOS push. Leave null to skip iOS."
  type        = string
  default     = null
}

variable "apns_key_id" {
  description = "The .p8 key's 10-character key ID."
  type        = string
  default     = null
}

variable "apns_team_id" {
  description = "Your 10-character Apple team ID."
  type        = string
  default     = null
}

variable "apns_bundle_id" {
  description = "The iOS bundle identifier (react-native-push uses io.hibira.examples.push)."
  type        = string
  default     = "io.hibira.examples.push"
}

variable "fcm_service_account_path" {
  description = "Path to a Firebase service account JSON file, for Android push. Leave null to skip Android."
  type        = string
  default     = null
}
