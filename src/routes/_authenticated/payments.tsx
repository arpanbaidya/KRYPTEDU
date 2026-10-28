import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Calendar,
  Building2,
  RefreshCw,
  FileText,
  User,
  GraduationCap,
  ShieldCheck,
  Receipt,
  Download,
} from "lucide-react";

import { PageHeader, Card } from "@/components/kr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  getStudentPaymentData,
  createPaymentOrder,
  verifyAndCapturePayment,
  recordFailedPayment,
} from "@/lib/payments.functions";
import {
  formatINR,
  calculatePaymentOptions,
  validateCustomAmount,
  type PaymentReceipt,
  type PaymentOptionType,
  type PaymentStatus,
} from "@/lib/payments";
import { loadRazorpayCheckoutScript } from "@/lib/razorpay.loader";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Course Fee & Payments — KRYPTEDU" },
      { name: "description", content: "Student course fee payment portal with Razorpay." },
      { property: "og:title", content: "Course Fee & Payments — KRYPTEDU" },
      { property: "og:description", content: "Student course fee payment portal with Razorpay." },
    ],
  }),
  beforeLoad: ({ context }) => {
    const role = (context as any)?.role;
    if (role === "admin") {
      throw redirect({ to: "/admin/payments" });
    }
    if (role === "faculty" || role === "placement") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: StudentPaymentPage,
});

function StudentPaymentPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["student-payment-portal"],
    queryFn: () => getStudentPaymentData(),
  });

  const [paymentOption, setPaymentOption] = useState<PaymentOptionType>("half");
  const [customAmountInput, setCustomAmountInput] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Receipt Modal state
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const feeItem = data?.feeItem;
  const remainingBalance = feeItem?.remaining_balance || 0;

  // Payment Options Calculations
  const currentOptions = useMemo(() => {
    return calculatePaymentOptions(remainingBalance);
  }, [remainingBalance]);

  const activePaymentAmount = useMemo(() => {
    if (paymentOption === "half") return currentOptions.half;
    if (paymentOption === "full") return currentOptions.full;
    if (paymentOption === "custom") {
      const parsed = parseFloat(customAmountInput);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, [paymentOption, currentOptions, customAmountInput]);

  const customAmountValidation = useMemo(() => {
    if (paymentOption !== "custom") return { valid: true };
    const num = parseFloat(customAmountInput);
    return validateCustomAmount(num, remainingBalance);
  }, [paymentOption, customAmountInput, remainingBalance]);

  const handleProceedToRazorpay = async () => {
    if (!feeItem) return;

    if (paymentOption === "custom" && !customAmountValidation.valid) {
      toast.error(customAmountValidation.error || "Invalid custom amount");
      return;
    }

    if (activePaymentAmount <= 0) {
      toast.error("Payment amount must be greater than zero.");
      return;
    }

    try {
      setIsProcessingPayment(true);

      // 1. Load Razorpay script
      const loaded = await loadRazorpayCheckoutScript();
      if (!loaded && typeof window !== "undefined" && !window.Razorpay) {
        throw new Error("Razorpay Checkout SDK failed to load. Please verify your internet connection.");
      }

      // 2. Create Razorpay Order on server
      const order = await createPaymentOrder({
        data: {
          payment_option: paymentOption,
          custom_amount: activePaymentAmount,
        },
      });

      // 3. Configure Razorpay modal options
      const options = {
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency,
        name: "KRYPTEDU",
        description: `Course Fee: ${feeItem.course_name}`,
        image: "https://kryptedu.app/logo.png",
        order_id: order.orderId,
        prefill: {
          name: feeItem.student_name,
          email: `${feeItem.student_roll_no.toLowerCase()}@kryptedu.edu`,
        },
        theme: {
          color: "#059669", // KRYPTEDU primary emerald
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            toast.loading("Verifying payment signature with Razorpay...");
            const verification = await verifyAndCapturePayment({
              data: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_method: "Razorpay Checkout",
              },
            });

            toast.dismiss();
            toast.success("Payment verified and captured successfully!");

            if (verification.receipt) {
              setReceiptData(verification.receipt);
              setIsReceiptModalOpen(true);
            }

            queryClient.invalidateQueries({ queryKey: ["student-payment-portal"] });
          } catch (vErr: any) {
            toast.dismiss();
            toast.error(vErr.message || "Payment verification failed.");
          }
        },
        modal: {
          ondismiss: async () => {
            setIsProcessingPayment(false);
            toast.info("Payment window closed.");
            try {
              await recordFailedPayment({
                data: {
                  razorpay_order_id: order.orderId,
                  reason: "Student cancelled checkout dialog.",
                },
              });
              queryClient.invalidateQueries({ queryKey: ["student-payment-portal"] });
            } catch {
              // ignore
            }
          },
        },
      };

      if (typeof window !== "undefined" && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (errResponse: any) => {
          setIsProcessingPayment(false);
          toast.error(
            errResponse?.error?.description || "Payment attempt was unsuccessful."
          );
        });
        rzp.open();
      } else {
        throw new Error("Razorpay Checkout SDK failed to load. Please ensure your internet connection is active.");
      }
    } catch (err: any) {
      toast.error(err.message || "Could not initiate payment order.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "Paid":
        return (
          <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 border-emerald-500/30 gap-1 font-medium">
            <CheckCircle2 className="size-3" /> Fully Cleared
          </Badge>
        );
      case "Partially Paid":
        return (
          <Badge className="bg-amber-600/15 text-amber-700 hover:bg-amber-600/25 border-amber-500/30 gap-1 font-medium">
            <Clock className="size-3" /> Partially Paid
          </Badge>
        );
      case "Failed":
        return (
          <Badge className="bg-red-600/15 text-red-700 hover:bg-red-600/25 border-red-500/30 gap-1 font-medium">
            <AlertCircle className="size-3" /> Payment Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1 font-medium">
            <AlertCircle className="size-3" /> Pending Payment
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="mx-auto size-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading your course fee details...</p>
      </div>
    );
  }

  if (!data?.isLinked || !feeItem) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Student Portal" title="Course Fee & Payments" />
        <Card className="p-8 text-center max-w-xl mx-auto space-y-4">
          <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 grid place-items-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <h2 className="text-lg font-bold">Student Record Not Linked</h2>
          <p className="text-sm text-muted-foreground">
            {data?.error || "Your user login has not yet been connected to a student profile. Please contact your college administrator to link your account."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <PageHeader
        eyebrow="Student Financial Portal"
        title="Course Fee & Online Payments"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 rounded-xl text-xs"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh Status
          </Button>
        }
      />

      {/* Student Personal Fee Overview Card */}
      <Card className="p-6 overflow-hidden relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="text-xs uppercase font-semibold text-primary tracking-wider">
              Student Enrollment Details
            </div>
            <h2 className="text-xl font-bold mt-1 text-foreground">{feeItem.student_name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span className="font-mono bg-secondary px-2 py-0.5 rounded font-medium">
                {feeItem.student_roll_no}
              </span>
              <span>·</span>
              <span>{feeItem.student_dept} Department</span>
              <span>·</span>
              <span>Year {feeItem.student_year}</span>
              <span>·</span>
              <span className="font-medium text-foreground">{feeItem.course_name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(feeItem.status)}
          </div>
        </div>

        {/* Financial Numbers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
            <div className="text-xs text-muted-foreground font-medium">Total Course Fee</div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {formatINR(feeItem.total_fee)}
            </div>
            <div className="text-[11px] text-subtle mt-0.5">Standardized Annual Tuition</div>
          </div>

          <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
            <div className="text-xs text-emerald-800 font-medium">Amount Confirmed Paid</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 mt-1">
              {formatINR(feeItem.amount_paid)}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5">Verified via Razorpay Ledger</div>
          </div>

          <div className="rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
            <div className="text-xs text-amber-800 font-medium">Outstanding Balance</div>
            <div className="text-2xl font-bold tracking-tight text-amber-700 mt-1">
              {formatINR(feeItem.remaining_balance)}
            </div>
            <div className="text-[11px] text-amber-600/80 mt-0.5">
              {feeItem.due_date ? `Due by ${new Date(feeItem.due_date).toLocaleDateString("en-IN")}` : "Payable this term"}
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Options Checkout Section */}
      {remainingBalance > 0 ? (
        <Card className="p-6 space-y-5 border-primary/30 shadow-soft">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              Select Payment Option
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose an installment option or enter a custom amount to pay via the secure Razorpay gateway.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {/* Option A: Pay Half */}
            <div
              onClick={() => {
                setPaymentOption("half");
                setCustomAmountInput(Math.round(remainingBalance / 2).toString());
              }}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                paymentOption === "half"
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Option A</span>
                <div
                  className={`size-4 rounded-full border grid place-items-center ${
                    paymentOption === "half" ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                >
                  {paymentOption === "half" && <div className="size-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="font-bold text-lg text-foreground">{formatINR(currentOptions.half)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Pay 50% of your remaining balance
              </div>
            </div>

            {/* Option B: Pay Full */}
            <div
              onClick={() => {
                setPaymentOption("full");
                setCustomAmountInput(remainingBalance.toString());
              }}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                paymentOption === "full"
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Option B</span>
                <div
                  className={`size-4 rounded-full border grid place-items-center ${
                    paymentOption === "full" ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                >
                  {paymentOption === "full" && <div className="size-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="font-bold text-lg text-foreground">{formatINR(currentOptions.full)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Clear full outstanding course fee
              </div>
            </div>

            {/* Option C: Custom Amount */}
            <div
              onClick={() => setPaymentOption("custom")}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                paymentOption === "custom"
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Option C</span>
                <div
                  className={`size-4 rounded-full border grid place-items-center ${
                    paymentOption === "custom" ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                >
                  {paymentOption === "custom" && <div className="size-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="font-bold text-lg text-foreground">Custom Amount</div>
              <div className="text-xs text-muted-foreground mt-1">
                Specify installment amount
              </div>
            </div>
          </div>

          {/* Custom Input Field */}
          {paymentOption === "custom" && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
              <label className="text-xs font-medium text-foreground">
                Enter Payment Amount (₹ INR):
              </label>
              <div className="relative max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={customAmountInput}
                  onChange={(e) => setCustomAmountInput(e.target.value)}
                  className="pl-8 rounded-xl font-medium"
                  min="1"
                  max={remainingBalance}
                />
              </div>
              {!customAmountValidation.valid && (
                <div className="text-xs text-red-600 font-medium">
                  {customAmountValidation.error}
                </div>
              )}
            </div>
          )}

          {/* Checkout Bar */}
          <div className="rounded-2xl bg-emerald-600/10 border border-emerald-500/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase font-bold text-emerald-800">Total Amount to Pay Now</div>
              <div className="text-2xl font-black text-emerald-700 mt-0.5">
                {formatINR(activePaymentAmount)}
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleProceedToRazorpay}
              disabled={
                isProcessingPayment ||
                activePaymentAmount <= 0 ||
                (paymentOption === "custom" && !customAmountValidation.valid)
              }
              className="w-full sm:w-auto gap-2 rounded-xl px-8 font-bold shadow-soft"
            >
              {isProcessingPayment ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Connecting Razorpay...
                </>
              ) : (
                <>
                  <CreditCard className="size-4" />
                  Proceed to Pay {formatINR(activePaymentAmount)}
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center bg-emerald-50/50 border-emerald-200 space-y-2">
          <div className="size-12 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto">
            <CheckCircle2 className="size-6" />
          </div>
          <h3 className="text-lg font-bold text-emerald-900">Your Course Fee is Fully Paid!</h3>
          <p className="text-xs text-emerald-700 max-w-md mx-auto">
            You have zero outstanding fee dues for the academic year. You can view or print your verified payment receipts below.
          </p>
        </Card>
      )}

      {/* Verified Payment History Section */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              My Payment History & Receipts
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified transactions recorded in the institutional ledger.
            </p>
          </div>
        </div>

        {data.transactions.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground border rounded-xl bg-secondary/10">
            No payments have been recorded for your account yet.
          </div>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden">
            {data.transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/20 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{formatINR(tx.amount)}</span>
                    <Badge
                      variant={tx.status === "captured" ? "default" : "destructive"}
                      className="text-[10px] uppercase font-bold"
                    >
                      {tx.status === "captured" ? "Confirmed" : tx.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>
                      {new Date(tx.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>·</span>
                    <span className="font-mono text-[11px]">Ref: {tx.razorpay_payment_id || tx.razorpay_order_id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {tx.receipt_number && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReceiptData({
                          receiptNumber: tx.receipt_number || "KRYPT-REC",
                          studentName: feeItem.student_name,
                          studentRollNo: feeItem.student_roll_no,
                          studentDept: feeItem.student_dept,
                          courseName: feeItem.course_name,
                          amountPaid: tx.amount,
                          currency: tx.currency,
                          remainingBalance: feeItem.remaining_balance,
                          razorpayPaymentId: tx.razorpay_payment_id || "N/A",
                          razorpayOrderId: tx.razorpay_order_id,
                          paymentDate: tx.verified_at || tx.created_at,
                          paymentMethod: tx.payment_method || "Razorpay Online",
                          paymentOption: tx.payment_option,
                        });
                        setIsReceiptModalOpen(true);
                      }}
                      className="gap-1.5 rounded-xl text-xs"
                    >
                      <Printer className="size-3.5" />
                      View Receipt
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Official Verified Printable Receipt Dialog */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden">
          <div id="kryptedu-student-receipt" className="p-6 bg-white text-slate-900 space-y-4">
            <div className="border-b pb-4 text-center">
              <div className="text-xl font-black tracking-wider text-emerald-700">KRYPTEDU</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Smart Campus Analytics · Student Fee Receipt
              </div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                OFFICIAL PAYMENT RECEIPT
              </div>
            </div>

            {receiptData && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Receipt Number:</span>
                    <strong className="font-mono text-slate-800 text-xs">{receiptData.receiptNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Date & Time:</span>
                    <strong className="text-slate-800">
                      {new Date(receiptData.paymentDate).toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Razorpay Payment ID:</span>
                    <strong className="font-mono text-slate-800 text-[11px] truncate block">
                      {receiptData.razorpayPaymentId}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Razorpay Order ID:</span>
                    <strong className="font-mono text-slate-800 text-[11px] truncate block">
                      {receiptData.razorpayOrderId}
                    </strong>
                  </div>
                </div>

                <div className="border rounded-xl p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student Name:</span>
                    <strong className="text-slate-800">{receiptData.studentName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Roll Number:</span>
                    <strong className="font-mono text-slate-800">{receiptData.studentRollNo}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="text-slate-700">{receiptData.studentDept}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Course:</span>
                    <span className="text-slate-700">{receiptData.courseName}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-slate-700">Amount Paid (INR):</span>
                    <strong className="text-xl font-black text-emerald-800">
                      {formatINR(receiptData.amountPaid)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center border-t border-emerald-200 pt-2 text-xs">
                    <span className="text-slate-600">Remaining Balance:</span>
                    <strong className="font-bold text-slate-800">
                      {formatINR(receiptData.remainingBalance)}
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] text-center text-slate-400 pt-2 border-t">
                  Electronically generated receipt verified through Razorpay & Supabase RLS. No physical signature required.
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-slate-50 p-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReceiptModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-2 rounded-xl text-xs font-semibold"
            >
              <Printer className="size-3.5" />
              Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
