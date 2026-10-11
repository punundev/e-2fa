.PHONY: all install dev build test typecheck clean

all: install typecheck test build

install:
	pnpm install

dev:
	pnpm run dev

build:
	pnpm run build

test:
	pnpm run test

typecheck:
	pnpm run typecheck

clean:
	rm -rf dist
