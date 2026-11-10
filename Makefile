.PHONY: all install dev build test typecheck clean server migrate

all: install typecheck test build

install:
	pnpm install

dev:
	pnpm run dev

server:
	pnpm run server:dev

migrate:
	pnpm run db:migrate

build:
	pnpm run build
	rm -f extension.zip
	cd dist && zip -r ../extension.zip .

test:
	pnpm run test

typecheck:
	pnpm run typecheck

clean:
	rm -rf dist extension.zip
