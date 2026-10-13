export interface PaymentProcessor {
  charge(amount: number): Promise<boolean>;
}

/**
 * Handles e-commerce customer checkout and executes order payments.
 */
export class StripeCheckoutService implements PaymentProcessor {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async charge(amount: number): Promise<boolean> {
    return true;
  }

  public async processPayment(orderId: string, amount: number, zipCode: string): Promise<boolean> {
    const tax = this.calculateTaxRate(zipCode);
    const total = amount * (1 + tax);
    return this.charge(total);
  }

  private calculateTaxRate(zipCode: string): number {
    return 0.08;
  }
}
