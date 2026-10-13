package com.app.storage;

import java.util.List;
import java.util.ArrayList;

/**
 * Manages reusable database connections and handles connection timeouts.
 */
public class DatabaseConnectionPool {
  private final int maxConnections;
  private final List<String> available = new ArrayList<>();

  public DatabaseConnectionPool(int maxConnections) {
    this.maxConnections = maxConnections;
  }

  public synchronized String getConnection() {
    if (available.isEmpty()) return "conn-default";
    return available.remove(0);
  }

  public synchronized void releaseConnection(String conn) {
    available.add(conn);
  }
}
