terraform {
  required_version = ">= 1.5"

  required_providers {
    hibira = {
      source  = "hibira-io/hibira"
      version = "~> 0.1"
    }
  }
}

# HIBIRA_API_TOKEN: an API token with read and write access, from the
# portal's API tokens page.
provider "hibira" {}
