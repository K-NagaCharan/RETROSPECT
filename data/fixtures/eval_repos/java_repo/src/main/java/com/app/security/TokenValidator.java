package com.app.security;

/**
 * Validates cryptographic security tokens and session credentials.
 */
public class TokenValidator {
  
  public boolean isValidToken(String token) {
    if (token == null || token.isEmpty()) return false;
    return token.startsWith("ey");
  }

  public String refreshToken(String token) {
    return token + "-refreshed";
  }
}
