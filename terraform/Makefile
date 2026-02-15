BUILD_ENV ?= dev

VAR_FILE := ./$(BUILD_ENV)/terraform.tfvars

.PHONY: init validate plan apply destroy fmt

init:
	@echo "Initializing Terraform..."
	terraform init -backend-config=backend.conf -backend-config="key=transfer/${BUILD_ENV}/terraform.tfstate"

validate:
	@echo "Validating Terraform"
	terraform validate $(ARGS)

plan:
	@echo "Planning Terraform changes using $(VAR_FILE)..."
	terraform plan -var-file=terraform.tfvars -var-file=$(VAR_FILE)

apply:
	@echo "Applying Terraform changes using $(VAR_FILE)..."
	terraform apply -var-file=terraform.tfvars -var-file=$(VAR_FILE) $(ARGS)

destroy:
	@echo "Destroying Terraform-managed infrastructure using $(VAR_FILE)..."
	terraform destroy -var-file=terraform.tfvars -var-file=$(VAR_FILE) $(ARGS)

fmt:
	@echo "Formatting Terraform code..."
	terraform fmt
