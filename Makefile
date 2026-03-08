.PHONY: dev build preview install

install:
	pnpm install

dev: install
	pnpm dev

build: install
	pnpm build

preview: install
	pnpm preview
