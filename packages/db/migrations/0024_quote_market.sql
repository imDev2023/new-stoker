CREATE TABLE "quote_candles" (
	"mint" text NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	CONSTRAINT "quote_candles_mint_time_pk" PRIMARY KEY("mint","time")
);
--> statement-breakpoint
CREATE TABLE "quote_prices" (
	"mint" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"price_usd" numeric NOT NULL,
	CONSTRAINT "quote_prices_mint_recorded_at_pk" PRIMARY KEY("mint","recorded_at")
);
--> statement-breakpoint
ALTER TABLE "quote_assets" ADD COLUMN "stock_price_usd" numeric;--> statement-breakpoint
ALTER TABLE "quote_assets" ADD COLUMN "stock_price_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "quote_candles_time_idx" ON "quote_candles" USING btree ("time");--> statement-breakpoint
CREATE INDEX "quote_prices_recorded_at_idx" ON "quote_prices" USING btree ("recorded_at");