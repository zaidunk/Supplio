import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          Fondasi siap. Inventory, supplier, dan procurement menyusul di fase berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Anda sudah masuk sebagai owner dan data dipisahkan per bisnis.
      </CardContent>
    </Card>
  );
}
