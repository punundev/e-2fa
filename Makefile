.PHONY: all install dev build test typecheck clean

all: install typecheck test build

install:
	pnpm install

dev:
	pnpm run dev

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
