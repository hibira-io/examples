<?php

namespace Database\Seeders;

use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * The demo's four accounts and one order. Local demo only: refuses to run
 * in production, and every account shares the password DEMO_PASSWORD
 * (default "demo-password").
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('DemoSeeder creates shared demo accounts; it does not run in production.');
        }

        $password = Hash::make((string) env('DEMO_PASSWORD', 'demo-password'));

        $customer = $this->user('customer@demo.test', '林小美（客戶）', User::CUSTOMER, $password);
        $this->user('manager.a@demo.test', '王經理（主管 A）', User::APPROVER, $password);
        $this->user('manager.b@demo.test', '陳主任（主管 B）', User::APPROVER, $password);
        $this->user('outsider@demo.test', '路人（無權限）', User::NONE, $password);

        Order::query()->updateOrCreate(['number' => 'DEMO-1042'], [
            'customer_id' => $customer->id,
            'description' => '無線降噪耳機（示範商品）',
            'currency' => 'USD',
            'paid_amount' => 4900,
            'refunded_amount' => 0,
        ]);
    }

    protected function user(string $email, string $name, string $role, string $password): User
    {
        return User::query()->updateOrCreate(['email' => $email], [
            'name' => $name,
            'role' => $role,
            'password' => $password,
        ]);
    }
}
