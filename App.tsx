import React, { useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { validateTransactionDraft } from "./src/transactionValidation.cjs";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const supabase = createClient(
  "https://husoqhevdwwirzbgjaex.supabase.co",
  "sb_publishable_mTRgRKDsUwXEMeUe0bJKbg_qAOP1bzL",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

const OWNER_EMAIL = "rahulkarunathilake4@gmail.com";


type Tab = "Home" | "Stones" | "Add" | "Value Add" | "Accounts";

const NAV: { key: Tab; icon: string }[] = [
  { key: "Home", icon: "⌂" },
  { key: "Stones", icon: "◇" },
  { key: "Add", icon: "+" },
  { key: "Value Add", icon: "✧" },
  { key: "Accounts", icon: "≡" },
];

const colors = {
  ink: "#10221F",
  inkSoft: "#536560",
  paper: "#F6F7F2",
  card: "#FFFFFF",
  green: "#1E6A55",
  greenLight: "#E5F0E9",
  gold: "#B78A45",
  line: "#E3E8E1",
  muted: "#8A9690",
  danger: "#9B4B3E",
};

function Pill({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "gold" | "muted" }) {
  const backgroundColor = tone === "gold" ? "#F6EEDF" : tone === "muted" ? "#ECEFEB" : colors.greenLight;
  const color = tone === "gold" ? "#805C22" : tone === "muted" ? colors.inkSoft : colors.green;
  return <View style={[styles.pill, { backgroundColor }]}><Text style={[styles.pillText, { color }]}>{children}</Text></View>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Text style={styles.sectionAction}>{action}</Text> : null}</View>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [pendingTransactionKey, setPendingTransactionKey] = useState("");

  useEffect(() => {
    let active = true;

    const validateOwnerSession = async (session: Session | null) => {
      if (!session) {
        if (active) setAuthSession(null);
        return;
      }

      // Validate the access token with Supabase Auth instead of trusting
      // an email value stored in the browser session.
      const { data, error } = await supabase.auth.getUser(session.access_token);
      const verifiedEmail = data.user?.email?.trim().toLowerCase();
      if (error || !data.user || verifiedEmail !== OWNER_EMAIL) {
        if (active) setAuthSession(null);
        await supabase.auth.signOut();
        return;
      }
      if (active) setAuthSession(session);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (active) setAuthSession(null);
        return;
      }
      void validateOwnerSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthSession(null);
        return;
      }
      // Keep the UI locked while the token and owner identity are checked.
      setAuthSession(null);
      Promise.resolve().then(() => validateOwnerSession(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthBusy(true);
    try {
      const redirectTo = typeof window !== "undefined" ? window.location.href.split(/[?#]/)[0] : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { prompt: "select_account" } }
      });
      if (error) Alert.alert("Google sign-in unavailable", error.message);
    } catch (error) {
      Alert.alert("Sign-in failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Could not sign out", error.message);
  };
  const [note, setNote] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [stoneWeight, setStoneWeight] = useState("");
  const [supplier, setSupplier] = useState("");
  const [transactionType, setTransactionType] = useState<"Purchase" | "Expense" | "Sale" | "Payment">("Purchase");
  const [stoneDescription, setStoneDescription] = useState("");
  const [stoneColour, setStoneColour] = useState("");
  const [stoneId, setStoneId] = useState("");
  const [paymentDirection, setPaymentDirection] = useState<"Incoming" | "Outgoing">("Outgoing");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank transfer" | "Cheque" | "Other">("Cash");
  const [valueCategory, setValueCategory] = useState<"Heating" | "Preforming" | "Faceting" | "Transport" | "Other">("Heating");
  const [valueStoneId, setValueStoneId] = useState("");
  const [valueProvider, setValueProvider] = useState("");
  const [valueAmount, setValueAmount] = useState("");
  const [valuePaid, setValuePaid] = useState<"Unpaid" | "Part paid" | "Paid">("Unpaid");
  const [valueNote, setValueNote] = useState("");

  const previewOnly = () => Alert.alert(
    "Not recorded yet",
    "This is a local preview only. Nothing is saved to Supabase or Airtable. Secure sign-in, server-side validation and read-back verification must be connected before this entry can be recorded."
  );

  const saveTransaction = async () => {
    if (!authSession || authSession.user.email?.trim().toLowerCase() !== "rahulkarunathilake4@gmail.com") {
      Alert.alert("Owner sign-in required", "Sign in with the authorised Google account before saving.");
      return;
    }
    if (transactionType !== "Purchase" && transactionType !== "Payment") {
      Alert.alert("Not enabled yet", "Real saving is currently enabled only for purchases and payments. Sales and expenses remain preview-only until their additional payment fields are connected.");
      return;
    }
    const key = pendingTransactionKey || ("TP-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14));
    setPendingTransactionKey(key);
    setSavingTransaction(true);
    try {
      const payload = {
        type: transactionType,
        idempotency_key: key,
        counterparty: supplier.trim(),
        description: stoneDescription.trim() || (transactionType === "Payment" ? "Payment" : ""),
        colour: stoneColour.trim(),
        stone_id: stoneId.trim() || (transactionType === "Purchase" ? ("RG-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + key.slice(-6).toUpperCase()) : ""),
        weight: transactionType === "Purchase" ? Number(stoneWeight) : undefined,
        amount: Number(purchasePrice),
        payment_direction: transactionType === "Payment" ? paymentDirection : undefined,
        payment_method: transactionType === "Payment" ? paymentMethod : undefined,
        notes: note.trim(),
      };
      const { data, error } = await supabase.functions.invoke("raka-finance-intake", { body: payload });
      if (error) {
        Alert.alert("Save not verified", "The server did not confirm a verified save. Your submission key has been retained to reduce duplicate risk. Check the Transaction Intake table before retrying. Details: " + error.message);
        return;
      }
      if (data?.success === true && data?.status === "Written and Verified") {
        Alert.alert("Saved and verified", "Transaction: " + data.type + "\nIntake ID: " + data.intake_id + "\nBusiness record: " + data.record_id + "\n\nAirtable read-back matched the unique transaction key.");
        setPendingTransactionKey("");
        setPurchasePrice("");
        setStoneWeight("");
        setSupplier("");
        setStoneDescription("");
        setStoneColour("");
        setStoneId("");
        setNote("");
      } else {
        Alert.alert("Needs review — not confirmed as saved", String(data?.message || data?.error || "The intake may be in recovery. Do not submit this transaction with a new key." ) + (data?.intake_id ? "\nIntake ID: " + data.intake_id : ""));
      }
    } catch (error) {
      Alert.alert("Save not verified", "No successful save is claimed. Keep this transaction unchanged and inspect Transaction Intake before retrying. " + (error instanceof Error ? error.message : ""));
    } finally {
      setSavingTransaction(false);
    }
  };

  const reviewTransaction = () => {
    const validation = validateTransactionDraft({
      type: transactionType,
      counterparty: supplier,
      amount: purchasePrice,
      weight: stoneWeight,
      stoneId,
      paymentDirection,
      paymentMethod,
    });
    if (!validation.valid) {
      Alert.alert("Please check the transaction", validation.errors.join("\n"));
      return;
    }
    const details = [
      "Type: " + transactionType,
      "Counterparty: " + supplier.trim(),
      stoneId.trim() ? "Stone ID: " + stoneId.trim() : (transactionType === "Purchase" ? "Stone ID: generated when saved" : ""),
      stoneDescription.trim() ? "Stone: " + stoneDescription.trim() : "",
      stoneColour.trim() ? "Colour: " + stoneColour.trim() : "",
      transactionType === "Purchase" && stoneWeight.trim() ? "Weight: " + stoneWeight + " ct" : "",
      transactionType === "Payment" ? "Direction: " + paymentDirection : "",
      transactionType === "Payment" ? "Method: " + paymentMethod : "",
      "Amount: LKR " + Number(purchasePrice).toLocaleString("en-LK"),
      note.trim() ? "Notes: " + note.trim() : "",
      "",
      transactionType === "Purchase" || transactionType === "Payment"
        ? "Will be saved to Airtable only after you confirm. The app reports success only after read-back verification."
        : "PREVIEW ONLY — sale/expense saving is not enabled yet."
    ].filter(Boolean).join("\n");
    Alert.alert("Review transaction", details, [
      { text: "Edit", style: "cancel" },
      { text: transactionType === "Purchase" || transactionType === "Payment" ? (savingTransaction ? "Saving…" : "Save to Raka Gems") : "Close", onPress: transactionType === "Purchase" || transactionType === "Payment" ? saveTransaction : previewOnly, style: "default" }
    ]);
  };

  const reviewValueAddition = () => {
    const amount = Number(valueAmount);
    if (!valueStoneId.trim()) {
      Alert.alert("Stone ID needed", "Link this cost to the stone it belongs to.");
      return;
    }
    if (!valueAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Check the amount", "Enter a valid value-addition cost greater than zero in LKR.");
      return;
    }
    const details = [
      "Category: " + valueCategory,
      "Stone ID: " + valueStoneId.trim(),
      valueProvider.trim() ? "Provider: " + valueProvider.trim() : "",
      "Cost: LKR " + amount.toLocaleString("en-LK"),
      "Payment status: " + valuePaid,
      valueNote.trim() ? "Notes: " + valueNote.trim() : "",
      "",
      "PREVIEW ONLY — not saved to any database."
    ].filter(Boolean).join("\n");
    Alert.alert("Review value addition", details, [
      { text: "Edit", style: "cancel" },
      { text: "Close", onPress: previewOnly }
    ]);
  };

  const screenTitle = tab === "Home" ? "Your trading desk" :
    tab === "Stones" ? "Stone inventory" :
    tab === "Add" ? "Capture a transaction" :
    tab === "Value Add" ? "Value Addition" : "Accounts";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topbar}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>T</Text></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>TradePilot <Text style={styles.brandAI}>AI</Text></Text>
          <Text style={styles.brandSub}>RAKA GEMS WORKSPACE</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={authSession ? "Sign out" : "Continue with Google"}
          style={styles.loginButton}
          onPress={authSession ? signOut : signInWithGoogle}
          disabled={authBusy}
        >
          <Text style={styles.loginButtonText}>{authBusy ? "Opening…" : authSession ? "Sign out" : "G  Sign in"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>BUSINESS OVERVIEW</Text>
            <Text style={styles.pageTitle}>{screenTitle}</Text>
          </View>
          <Pill tone="gold">Preview build</Pill>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeIcon}>ⓘ</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>{authSession ? "Signed in — data saving still pending" : "Sign in with Google"}</Text>
            <Text style={styles.noticeBody}>{authSession ? `Signed in as ${authSession.user.email || "Google account"}. Inventory and financial writes remain disabled until the secure save workflow is connected.` : "Use your Google account to sign in. Inventory and financial records are not saved by this preview yet."}</Text>
          </View>
        </View>

        {tab === "Home" ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>✦  GEM TRADING</Text></View>
                <Text style={styles.heroDots}>•••</Text>
              </View>
              <Text style={styles.heroTitle}>Know every stone.{ "\n" }Control every rupee.</Text>
              <Text style={styles.heroBody}>Your inventory, processing costs, sales and payments — designed around how gem trading really works.</Text>
              <TouchableOpacity style={styles.heroButton} onPress={() => setTab("Add")}><Text style={styles.heroButtonText}>＋  Capture transaction</Text></TouchableOpacity>
              <View style={styles.heroDecoration}><View style={styles.gemShape} /></View>
            </View>

            <SectionTitle title="Your numbers" action="LKR · All time" />
            <View style={styles.metricsGrid}>
              <Metric label="STONES IN STOCK" value="—" note="Awaiting live data" />
              <Metric label="STOCK COST" value="—" note="Verified records only" />
              <Metric label="RECEIVABLES" value="—" note="Unpaid sales" />
              <Metric label="PAYABLES" value="—" note="Outstanding costs" />
            </View>

            <SectionTitle title="Quick actions" />
            <View style={styles.quickGrid}>
              <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Add")}><Text style={styles.quickIcon}>＋</Text><Text style={styles.quickTitle}>New purchase</Text><Text style={styles.quickBody}>Record rough or finished stones</Text></TouchableOpacity>
              <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Value Add")}><Text style={styles.quickIcon}>✧</Text><Text style={styles.quickTitle}>Add a cost</Text><Text style={styles.quickBody}>Heating, cutting, travel and more</Text></TouchableOpacity>
              <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Stones")}><Text style={styles.quickIcon}>◇</Text><Text style={styles.quickTitle}>Find a stone</Text><Text style={styles.quickBody}>Review stock and processing stage</Text></TouchableOpacity>
              <TouchableOpacity style={styles.quickCard} onPress={() => setTab("Accounts")}><Text style={styles.quickIcon}>↗</Text><Text style={styles.quickTitle}>Check accounts</Text><Text style={styles.quickBody}>Payments, balances and cash flow</Text></TouchableOpacity>
            </View>

            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>◷</Text>
              <Text style={styles.emptyTitle}>Activity will appear here</Text>
              <Text style={styles.emptyBody}>Once the secure backend is connected, this area will show verified purchases, processing updates, sales and payments.</Text>
            </View>
          </>
        ) : null}

        {tab === "Stones" ? (
          <>
            <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput placeholder="Search stone ID, colour or supplier" placeholderTextColor={colors.muted} style={styles.searchInput} /></View>
            <View style={styles.filterRow}><Pill>All stones</Pill><Pill tone="muted">In hand</Pill><Pill tone="muted">Processing</Pill><Pill tone="muted">Sold</Pill></View>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>◇</Text><Text style={styles.emptyTitle}>Inventory connection pending</Text>
              <Text style={styles.emptyBody}>Your existing Raka Gems records will be read and reconciled before the app displays live stock. Nothing has been imported or altered by this preview.</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={previewOnly}><Text style={styles.secondaryButtonText}>Check connection status</Text></TouchableOpacity>
            </View>
          </>
        ) : null}

        {tab === "Add" ? (
          <View style={styles.formCard}>
            <Text style={styles.formIntro}>Start with a message or enter the basics. AI-assisted extraction will be added after secure backend access is ready.</Text>
            <Text style={styles.fieldLabel}>TRANSACTION TYPE</Text>
            <View style={styles.typeRow}>
              {(["Purchase", "Expense", "Sale", "Payment"] as const).map((kind) => (
                <TouchableOpacity key={kind} onPress={() => setTransactionType(kind)}>
                  <Pill tone={transactionType === kind ? "green" : "muted"}>{kind}</Pill>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>STONE DESCRIPTION (OPTIONAL)</Text>
            <TextInput value={stoneDescription} onChangeText={setStoneDescription} placeholder="e.g. rough blue sapphire" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.fieldLabel}>COLOUR (OPTIONAL)</Text>
            <TextInput value={stoneColour} onChangeText={setStoneColour} placeholder="e.g. just blue" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.fieldLabel}>SUPPLIER / COUNTERPARTY</Text>
            <TextInput value={supplier} onChangeText={setSupplier} placeholder="e.g. supplier name" placeholderTextColor={colors.muted} style={styles.input} />
            {transactionType === "Sale" ? <>
              <Text style={styles.fieldLabel}>STONE ID (REQUIRED FOR SALE)</Text>
              <TextInput value={stoneId} onChangeText={setStoneId} placeholder="e.g. RG-20261014-001" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="characters" />
            </> : null}
            {transactionType === "Purchase" ? <Text style={styles.fieldLabel}>WEIGHT (CT)</Text> : null}
            {transactionType === "Purchase" ? <TextInput value={stoneWeight} onChangeText={setStoneWeight} keyboardType="decimal-pad" placeholder="e.g. 22" placeholderTextColor={colors.muted} style={styles.input} /> : null}
            {transactionType === "Payment" ? <>
              <Text style={styles.fieldLabel}>PAYMENT DIRECTION</Text>
              <View style={styles.typeRow}>{(["Incoming", "Outgoing"] as const).map((item) => <TouchableOpacity key={item} onPress={() => setPaymentDirection(item)}><Pill tone={paymentDirection === item ? "green" : "muted"}>{item}</Pill></TouchableOpacity>)}</View>
              <Text style={styles.fieldLabel}>PAYMENT METHOD</Text>
              <View style={styles.typeRow}>{(["Cash", "Bank transfer", "Cheque", "Other"] as const).map((item) => <TouchableOpacity key={item} onPress={() => setPaymentMethod(item)}><Pill tone={paymentMethod === item ? "green" : "muted"}>{item}</Pill></TouchableOpacity>)}</View>
            </> : null}
            <Text style={styles.fieldLabel}>AMOUNT (LKR)</Text>
            <TextInput value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" placeholder="e.g. 2200000" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.fieldLabel}>VOICE / CHAT NOTES</Text>
            <TextInput value={note} onChangeText={setNote} multiline placeholder="Describe the stone or transaction…" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} />
            <TouchableOpacity style={styles.primaryButton} onPress={reviewTransaction} disabled={savingTransaction}><Text style={styles.primaryButtonText}>{savingTransaction ? "Saving securely…" : "Review transaction  →"}</Text></TouchableOpacity>
            <Text style={styles.disclaimer}>Preview only. No financial record is saved in this build.</Text>
          </View>
        ) : null}

        {tab === "Value Add" ? (
          <>
            <Text style={styles.introText}>Record each processing or trade cost against the exact stone. Cost and payment status are separate.</Text>
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>COST CATEGORY</Text>
              <View style={styles.typeRow}>{(["Heating", "Preforming", "Faceting", "Transport", "Other"] as const).map((kind) => <TouchableOpacity key={kind} onPress={() => setValueCategory(kind)}><Pill tone={valueCategory === kind ? "green" : "muted"}>{kind}</Pill></TouchableOpacity>)}</View>
              <Text style={styles.fieldLabel}>STONE ID (REQUIRED)</Text>
              <TextInput value={valueStoneId} onChangeText={setValueStoneId} placeholder="e.g. RG-20261014-001" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="characters" />
              <Text style={styles.fieldLabel}>PROCESSOR / PAYEE (OPTIONAL)</Text>
              <TextInput value={valueProvider} onChangeText={setValueProvider} placeholder="e.g. heating workshop" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.fieldLabel}>COST (LKR)</Text>
              <TextInput value={valueAmount} onChangeText={setValueAmount} keyboardType="decimal-pad" placeholder="e.g. 5000" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.fieldLabel}>PAYMENT STATUS</Text>
              <View style={styles.typeRow}>{(["Unpaid", "Part paid", "Paid"] as const).map((status) => <TouchableOpacity key={status} onPress={() => setValuePaid(status)}><Pill tone={valuePaid === status ? "green" : "muted"}>{status}</Pill></TouchableOpacity>)}</View>
              <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
              <TextInput value={valueNote} onChangeText={setValueNote} multiline placeholder="Treatment details, receipt reference…" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} />
              <TouchableOpacity style={styles.primaryButton} onPress={reviewValueAddition}><Text style={styles.primaryButtonText}>Review cost  →</Text></TouchableOpacity>
              <Text style={styles.disclaimer}>Preview only. No cost is saved in this build.</Text>
            </View>
            <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Cost history appears here</Text><Text style={styles.emptyBody}>The connected version will show date, amount, provider, receipt, payment status and linked stone ID.</Text></View>
          </>
        ) : null}

        {tab === "Accounts" ? (
          <>
            <Text style={styles.introText}>A promise, cheque or invoice is not cash. Balances will update only from verified transactions and actual receipts or payments.</Text>
            <View style={styles.accountCard}><Text style={styles.accountLabel}>CASH & BANK BALANCE</Text><Text style={styles.accountValue}>—</Text><Text style={styles.accountNote}>Waiting for reconciled opening balances</Text></View>
            <View style={styles.metricsGrid}><Metric label="CUSTOMERS OWE" value="—" note="Receivables" /><Metric label="YOU OWE" value="—" note="Payables" /></View>
            <View style={styles.listCard}><View style={styles.listIcon}><Text>↓</Text></View><View style={{ flex: 1 }}><Text style={styles.listTitle}>Money received</Text><Text style={styles.listSubtitle}>Receipts and partial settlements</Text></View><Text style={styles.chevron}>›</Text></View>
            <View style={styles.listCard}><View style={styles.listIcon}><Text>↑</Text></View><View style={{ flex: 1 }}><Text style={styles.listTitle}>Money paid</Text><Text style={styles.listSubtitle}>Supplier and processing payments</Text></View><Text style={styles.chevron}>›</Text></View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.tabbar}>
        {NAV.map((item) => {
          const active = item.key === tab;
          return (
            <TouchableOpacity key={item.key} style={styles.tabItem} onPress={() => setTab(item.key)} accessibilityRole="button" accessibilityLabel={item.key}>
              <View style={[styles.tabIconWrap, active && styles.tabIconActive]}><Text style={[styles.tabIcon, active && styles.tabIconTextActive]}>{item.icon}</Text></View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topbar: { height: 68, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.paper },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#E6C58B", fontSize: 23, fontWeight: "800" },
  brandCopy: { marginLeft: 10, flex: 1 },
  brandName: { fontSize: 18, color: colors.ink, fontWeight: "800", letterSpacing: -0.4 },
  brandAI: { color: colors.gold },
  brandSub: { marginTop: 2, fontSize: 9, color: colors.inkSoft, letterSpacing: 1.5, fontWeight: "700" },
  loginButton: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  loginButtonText: { fontSize: 11, fontWeight: "800", color: colors.green },
  page: { padding: 18, paddingBottom: 28 },
  headingRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  eyebrow: { color: colors.green, fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginBottom: 5 },
  pageTitle: { color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -0.8 },
  pill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  pillText: { fontSize: 10, fontWeight: "800" },
  notice: { backgroundColor: "#FFF5E4", borderColor: "#F0DDB8", borderWidth: 1, borderRadius: 13, padding: 12, flexDirection: "row", gap: 10, marginBottom: 18 },
  noticeIcon: { color: "#946D2D", fontSize: 18, fontWeight: "800" },
  noticeTitle: { color: "#684B20", fontWeight: "800", fontSize: 12, marginBottom: 3 },
  noticeBody: { color: "#775D34", fontSize: 11, lineHeight: 16 },
  hero: { backgroundColor: colors.ink, borderRadius: 20, padding: 20, overflow: "hidden", marginBottom: 23, minHeight: 236 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  heroBadge: { borderColor: "#52625A", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  heroBadgeText: { color: "#D6C09A", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroDots: { color: "#8E9B91", letterSpacing: 3 },
  heroTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "800", lineHeight: 32, letterSpacing: -0.8, maxWidth: 270 },
  heroBody: { color: "#C2CCC3", fontSize: 12, lineHeight: 18, marginTop: 9, maxWidth: 265 },
  heroButton: { backgroundColor: "#E5C78E", borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14, alignSelf: "flex-start", marginTop: 17 },
  heroButtonText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  heroDecoration: { position: "absolute", right: -20, bottom: -30, opacity: 0.2 },
  gemShape: { width: 125, height: 125, borderWidth: 2, borderColor: "#E6C58B", transform: [{ rotate: "45deg" }], borderRadius: 18 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 11, marginTop: 3 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  sectionAction: { fontSize: 10, color: colors.inkSoft, fontWeight: "600" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  metric: { width: "48%", flexGrow: 1, backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 13, minHeight: 98 },
  metricLabel: { fontSize: 9, letterSpacing: 0.7, color: colors.inkSoft, fontWeight: "800" },
  metricValue: { fontSize: 23, fontWeight: "800", color: colors.ink, marginTop: 9 },
  metricNote: { fontSize: 10, color: colors.muted, marginTop: 3 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  quickCard: { width: "48%", flexGrow: 1, padding: 13, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, minHeight: 126 },
  quickIcon: { color: colors.green, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  quickTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  quickBody: { color: colors.inkSoft, fontSize: 10, lineHeight: 15, marginTop: 5 },
  emptyCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 22, alignItems: "center", marginBottom: 18 },
  emptyIcon: { color: colors.gold, fontSize: 28, marginBottom: 9 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", textAlign: "center" },
  emptyBody: { color: colors.inkSoft, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 7 },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 12, marginBottom: 12 },
  searchIcon: { color: colors.inkSoft, fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, minHeight: 45, color: colors.ink, fontSize: 12 },
  filterRow: { flexDirection: "row", gap: 7, flexWrap: "wrap", marginBottom: 16 },
  secondaryButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  secondaryButtonText: { color: colors.green, fontWeight: "800", fontSize: 11 },
  formCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 18 },
  formIntro: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, marginBottom: 17 },
  fieldLabel: { color: colors.inkSoft, fontSize: 9, letterSpacing: 0.9, fontWeight: "800", marginBottom: 7, marginTop: 12 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  input: { minHeight: 45, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: "#FBFCF9", paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 12 },
  twoFields: { flexDirection: "row", gap: 10 },
  multiline: { minHeight: 86, textAlignVertical: "top" },
  primaryButton: { backgroundColor: colors.green, borderRadius: 11, paddingVertical: 14, alignItems: "center", marginTop: 18 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  disclaimer: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 10 },
  introText: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginBottom: 16 },
  listCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginBottom: 9 },
  listIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.greenLight, alignItems: "center", justifyContent: "center", marginRight: 12 },
  listTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  listSubtitle: { color: colors.inkSoft, fontSize: 10, marginTop: 4 },
  chevron: { color: colors.muted, fontSize: 24, marginLeft: 10 },
  accountCard: { backgroundColor: colors.ink, borderRadius: 16, padding: 18, marginBottom: 13 },
  accountLabel: { color: "#C4D0C7", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  accountValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", marginTop: 10 },
  accountNote: { color: "#C4D0C7", fontSize: 11, marginTop: 5 },
  tabbar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: "#FFFFFF", paddingTop: 8, paddingBottom: 7, paddingHorizontal: 3 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabIconWrap: { minWidth: 34, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabIconActive: { backgroundColor: colors.greenLight },
  tabIcon: { color: colors.inkSoft, fontSize: 20, lineHeight: 23 },
  tabIconTextActive: { color: colors.green, fontWeight: "800" },
  tabLabel: { color: colors.muted, fontSize: 9, fontWeight: "600" },
  tabLabelActive: { color: colors.green, fontWeight: "800" },
});
