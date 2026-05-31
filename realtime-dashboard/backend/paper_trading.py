import time

class PaperTradeEngine:
    def __init__(self, initial_balance: float = 100000.0):
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.leverage = 1
        self.positions: dict[str, dict] = {}
        self.pending_orders: list[dict] = []
        self.trades: list[dict] = []
        self.equity_snapshots: list[dict] = []
        self.trade_id_counter = 0

    def buy(self, symbol: str, qty: float, price: float, sl: float = None, tp: float = None) -> dict:
        cost = qty * price
        margin_required = cost / self.leverage
        if margin_required > self.balance:
            return {"error": f"Insufficient balance. Margin needed: ${margin_required:,.2f}, have ${self.balance:,.2f} (1:{self.leverage} lev)"}
        if qty <= 0:
            return {"error": "Quantity must be positive"}
        self.balance -= margin_required
        return self._open_position(symbol, qty, price, sl, tp, "BUY")

    def sell(self, symbol: str, qty: float, price: float) -> dict:
        if symbol not in self.positions:
            return {"error": "No open position for this symbol"}
        pos = self.positions[symbol]
        if qty > pos["qty"]:
            return {"error": f"Insufficient position. Have {pos['qty']:.8f}"}
        if qty <= 0:
            return {"error": "Quantity must be positive"}
        cost_of_sold = pos["total_cost"] * (qty / pos["qty"])
        pnl = qty * price - cost_of_sold
        margin_release = cost_of_sold / self.leverage
        self.balance += margin_release + pnl
        pos["qty"] -= qty
        pos["total_cost"] -= cost_of_sold
        if pos["qty"] <= 0:
            del self.positions[symbol]
        self.trade_id_counter += 1
        trade = {
            "id": self.trade_id_counter, "symbol": symbol, "side": "SELL",
            "qty": round(qty, 8), "price": round(price, 2),
            "pnl": round(pnl, 2), "timestamp": int(time.time() * 1000),
        }
        self.trades.append(trade)
        return {"success": True, "pnl": round(pnl, 2), "trade": trade}

    def close_position(self, symbol: str, qty: float = None, price: float = None) -> dict:
        if symbol not in self.positions:
            return {"error": "No open position"}
        pos = self.positions[symbol]
        close_qty = qty if qty and qty <= pos["qty"] else pos["qty"]
        return self.sell(symbol, close_qty, price or pos.get("current_price", pos["entry_price"]))

    def place_limit_order(self, symbol: str, side: str, qty: float, limit_price: float, sl: float = None, tp: float = None) -> dict:
        if qty <= 0 or limit_price <= 0:
            return {"error": "Invalid order parameters"}
        self.trade_id_counter += 1
        order = {
            "id": self.trade_id_counter, "symbol": symbol, "side": side,
            "type": "LIMIT", "qty": round(qty, 8), "limit_price": round(limit_price, 2),
            "sl": round(sl, 2) if sl else None, "tp": round(tp, 2) if tp else None,
            "status": "PENDING", "created_at": int(time.time() * 1000),
        }
        self.pending_orders.append(order)
        return {"success": True, "order": order}

    def place_stop_order(self, symbol: str, side: str, qty: float, stop_price: float, limit_price: float = None, sl: float = None, tp: float = None) -> dict:
        if qty <= 0 or stop_price <= 0:
            return {"error": "Invalid order parameters"}
        self.trade_id_counter += 1
        order_type = "STOP_LIMIT" if limit_price else "STOP"
        order = {
            "id": self.trade_id_counter, "symbol": symbol, "side": side,
            "type": order_type, "qty": round(qty, 8), "stop_price": round(stop_price, 2),
            "limit_price": round(limit_price, 2) if limit_price else None,
            "sl": round(sl, 2) if sl else None, "tp": round(tp, 2) if tp else None,
            "status": "PENDING", "created_at": int(time.time() * 1000),
        }
        self.pending_orders.append(order)
        return {"success": True, "order": order}

    def cancel_order(self, order_id: int) -> dict:
        for o in self.pending_orders:
            if o["id"] == order_id:
                o["status"] = "CANCELED"
                self.pending_orders.remove(o)
                return {"success": True}
        return {"error": "Order not found"}

    def update_position_sltp(self, symbol: str, sl: float = None, tp: float = None) -> dict:
        if symbol not in self.positions:
            return {"error": "No position"}
        if sl: self.positions[symbol]["sl"] = sl
        if tp: self.positions[symbol]["tp"] = tp
        return {"success": True}

    def check_pending_orders(self, prices: dict[str, float]):
        filled = []
        for order in list(self.pending_orders):
            if order["status"] != "PENDING":
                continue
            current = prices.get(order["symbol"])
            if not current:
                continue
            price = current["price"]
            executed = False
            exec_price = None
            if order["type"] == "LIMIT":
                if order["side"] == "BUY" and price <= order["limit_price"]:
                    executed = True; exec_price = order["limit_price"]
                elif order["side"] == "SELL" and price >= order["limit_price"]:
                    executed = True; exec_price = order["limit_price"]
            elif order["type"] == "STOP":
                if order["side"] == "BUY" and price >= order["stop_price"]:
                    executed = True; exec_price = price
                elif order["side"] == "SELL" and price <= order["stop_price"]:
                    executed = True; exec_price = price
            elif order["type"] == "STOP_LIMIT":
                if order["side"] == "BUY" and price >= order["stop_price"]:
                    executed = True; exec_price = max(order["limit_price"], price)
                elif order["side"] == "SELL" and price <= order["stop_price"]:
                    executed = True; exec_price = min(order["limit_price"], price)
            if executed:
                order["status"] = "FILLED"
                order["filled_at"] = int(time.time() * 1000)
                order["filled_price"] = round(exec_price, 2)
                self.pending_orders.remove(order)
                if order["side"] == "BUY":
                    result = self.buy(order["symbol"], order["qty"], exec_price, order["sl"], order["tp"])
                else:
                    result = self.sell(order["symbol"], order["qty"], exec_price)
                filled.append({"order": order, "result": result})
        return filled

    def check_sltp(self, prices: dict[str, float]):
        triggered = []
        for symbol, pos in list(self.positions.items()):
            current = prices.get(symbol)
            if not current:
                continue
            price = current["price"]
            pos["current_price"] = price
            sl = pos.get("sl")
            tp = pos.get("tp")
            if sl and price <= sl:
                r = self.sell(symbol, pos["qty"], price)
                triggered.append({"symbol": symbol, "reason": "SL", "price": price, "result": r})
            elif tp and price >= tp:
                r = self.sell(symbol, pos["qty"], price)
                triggered.append({"symbol": symbol, "reason": "TP", "price": price, "result": r})
        return triggered

    def _open_position(self, symbol: str, qty: float, price: float, sl: float, tp: float, side: str) -> dict:
        self.trade_id_counter += 1
        if symbol in self.positions:
            pos = self.positions[symbol]
            total_qty = pos["qty"] + qty
            total_cost = pos.get("total_cost", pos["qty"] * pos["entry_price"]) + qty * price
            pos["qty"] = total_qty
            pos["entry_price"] = total_cost / total_qty
            pos["total_cost"] = total_cost
            if sl: pos["sl"] = min(pos.get("sl", sl), sl) if pos.get("sl") else sl
            if tp: pos["tp"] = max(pos.get("tp", tp), tp) if pos.get("tp") else tp
        else:
            p = {"qty": qty, "entry_price": price, "total_cost": qty * price, "sl": sl, "tp": tp, "current_price": price}
            self.positions[symbol] = p
        cost = qty * price
        trade = {
            "id": self.trade_id_counter, "symbol": symbol, "side": side,
            "qty": round(qty, 8), "price": round(price, 2), "cost": round(cost, 2),
            "timestamp": int(time.time() * 1000),
        }
        self.trades.append(trade)
        return {"success": True, "trade": trade}

    def get_positions_with_pnl(self, prices_dict: dict[str, float]) -> list[dict]:
        result = []
        for symbol, pos in self.positions.items():
            current_price = prices_dict.get(symbol, pos["entry_price"])
            market_value = pos["qty"] * current_price
            cost_basis = pos["qty"] * pos["entry_price"]
            pnl = market_value - cost_basis
            pnl_pct = ((current_price / pos["entry_price"]) - 1) * 100 if pos["entry_price"] else 0
            margin_used = cost_basis / self.leverage
            result.append({
                "symbol": symbol, "qty": round(pos["qty"], 8),
                "entry_price": round(pos["entry_price"], 2),
                "current_price": round(current_price, 2),
                "market_value": round(market_value, 2),
                "cost_basis": round(cost_basis, 2),
                "margin_used": round(margin_used, 2),
                "pnl": round(pnl, 2), "pnl_pct": round(pnl_pct, 2),
                "sl": pos.get("sl"), "tp": pos.get("tp"),
            })
        return result

    def get_portfolio(self, prices_dict: dict[str, float]) -> dict:
        positions = self.get_positions_with_pnl(prices_dict)
        total_position_value = sum(p["market_value"] for p in positions)
        total_margin_used = sum(p["margin_used"] for p in positions)
        total_equity = self.balance + sum(p["pnl"] for p in positions)
        total_pnl = total_equity - self.initial_balance
        total_pnl_pct = (total_pnl / self.initial_balance) * 100 if self.initial_balance else 0
        return {
            "balance": round(self.balance, 2),
            "leverage": self.leverage,
            "position_value": round(total_position_value, 2),
            "margin_used": round(total_margin_used, 2),
            "margin_free": round(self.balance, 2),
            "total_equity": round(total_equity, 2),
            "total_pnl": round(total_pnl, 2), "total_pnl_pct": round(total_pnl_pct, 2),
            "position_count": len(self.positions), "trade_count": len(self.trades),
            "positions": positions, "pending_orders": [o for o in self.pending_orders if o["status"] == "PENDING"],
        }

    def snapshot_equity(self, prices_dict: dict[str, float]):
        equity = self.balance
        for symbol, pos in self.positions.items():
            current_price = prices_dict.get(symbol, pos["entry_price"])
            equity += pos["qty"] * current_price
        self.equity_snapshots.append({"timestamp": int(time.time() * 1000), "equity": round(equity, 2)})
        if len(self.equity_snapshots) > 1000:
            self.equity_snapshots = self.equity_snapshots[-500:]

    def tick(self, prices_dict: dict[str, float]):
        filled = self.check_pending_orders(prices_dict)
        sltp = self.check_sltp(prices_dict)
        return {"filled_orders": filled, "triggered_sltp": sltp}

    def reset(self, balance: float = 100000.0):
        self.__init__(initial_balance=balance)
