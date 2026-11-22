"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const colors = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#e11d48", "#0891b2"];

export function DashboardCharts({
  monthly,
  categories,
}: {
  monthly: { month: string; stockIn: number; stockOut: number; purchases: number; sales: number }[];
  categories: { name: string; products: number; quantity: number }[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-semibold">Stock in vs stock out</h2>
            <p className="text-sm text-muted-foreground">Quantity moved over the last six months</p>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="stockIn" name="Stock in" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="stockOut" name="Stock out" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <h2 className="font-semibold">Monthly sales and purchases</h2>
            <p className="text-sm text-muted-foreground">Confirmed sales and received purchases</p>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sales" name="Sales" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="purchases" name="Purchases" stroke="#0f766e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader>
          <div>
            <h2 className="font-semibold">Category distribution</h2>
            <p className="text-sm text-muted-foreground">Product count by category</p>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add products to see the category mix.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categories} dataKey="products" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {categories.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
