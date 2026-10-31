.PHONY: install dev dev-backend start build test db-setup seed docs-lint

install: ## Install dependencies
	pnpm install

dev: ## Run Express backend in watch mode
	pnpm dev

dev-backend: dev

start: ## Run production build
	pnpm start

build: ## Build TypeScript & bundle OpenAPI
	pnpm build

test: ## Run Vitest tests
	pnpm test

db-setup: ## Setup MongoDB schemas & indexes
	pnpm db:setup

seed: ## Seed demo users, doctors, and patients
	pnpm seed

docs-lint: ## Lint OpenAPI spec
	pnpm docs:lint

