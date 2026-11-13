declare module "javascript-lp-solver" {
  export interface LpSolution {
    feasible: boolean;
    /** Nilai fungsi tujuan. */
    result: number;
    bounded?: boolean;
    isIntegral?: boolean;
    /** Nilai variabel non-nol, kunci = nama variabel. */
    [variable: string]: number | boolean | undefined;
  }

  export interface LpModel {
    optimize: string;
    opType: "min" | "max";
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
    ints?: Record<string, 1>;
    binaries?: Record<string, 1>;
    options?: { timeout?: number; tolerance?: number };
  }

  const solver: { Solve(model: LpModel): LpSolution };
  export default solver;
}
