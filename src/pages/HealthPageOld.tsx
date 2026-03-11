import React, { useState, useEffect } from 'react';
import { useSettingsStore, useAuthStore } from '@/stores';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Droplets, Weight, Ruler, TrendingUp, Calendar, Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WaterEntry, WeightEntry, WaistEntry, HealthViewPeriod, HealthGoals } from '@/types';

export default function HealthPage() {
  const timezone = useSettingsStore(s => s.timezone);
  const user = useAuthStore(s => s.user);
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [todayData, setTodayData] = useState<HealthData | null>(null);
  const [waterIntake, setWaterIntake] = useState(0);
  const [weight, setWeight] = useState('');
  const [waistCircumference, setWaistCircumference] = useState('');
  const [viewPeriod, setViewPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');

  // Mock data - trong thực tế sẽ load từ store/api
  useEffect(() => {
    const mockData: HealthData[] = [
      {
        id: '1',
        userId: user?.id || '',
        date: format(new Date(), 'yyyy-MM-dd'),
        waterIntake: 1500,
        weight: 70,
        waistCircumference: 85,
        createdAt: Date.now()
      },
      // Add more mock data for previous days
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `${i + 2}`,
        userId: user?.id || '',
        date: format(subDays(new Date(), i + 1), 'yyyy-MM-dd'),
        waterIntake: Math.floor(Math.random() * 2000) + 1000,
        weight: 70 + Math.random() * 2 - 1,
        waistCircumference: 85 + Math.random() * 2 - 1,
        createdAt: Date.now() - (i + 1) * 24 * 60 * 60 * 1000
      }))
    ];
    setHealthData(mockData);
    
    const today = mockData.find(d => d.date === format(new Date(), 'yyyy-MM-dd'));
    setTodayData(today || null);
    if (today) {
      setWaterIntake(today.waterIntake);
      setWeight(today.weight?.toString() || '');
      setWaistCircumference(today.waistCircumference?.toString() || '');
    }
  }, [user?.id]);

  const dailyWaterGoal = 2000; // ml
  const waterPercentage = Math.min((waterIntake / dailyWaterGoal) * 100, 100);

  const addWater = (amount: number) => {
    const newIntake = waterIntake + amount;
    setWaterIntake(newIntake);
    // TODO: Save to store/backend
  };

  const saveHealthData = () => {
    const newData: HealthData = {
      id: todayData?.id || Date.now().toString(),
      userId: user?.id || '',
      date: format(new Date(), 'yyyy-MM-dd'),
      waterIntake,
      weight: weight ? parseFloat(weight) : undefined,
      waistCircumference: waistCircumference ? parseFloat(waistCircumference) : undefined,
      createdAt: Date.now()
    };
    
    // TODO: Save to store/backend
    console.log('Saving health data:', newData);
  };

  const getFilteredData = () => {
    const now = new Date();
    let startDate = startOfDay(now);
    
    switch (viewPeriod) {
      case 'day':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = subDays(now, 7);
        break;
      case 'month':
        startDate = subDays(now, 30);
        break;
      case 'year':
        startDate = subDays(now, 365);
        break;
    }
    
    return healthData.filter(d => new Date(d.date) >= startDate);
  };

  const filteredData = getFilteredData();

  return (
    <div className="health-page p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sức khỏe</h1>
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year'] as const).map(period => (
            <Button
              key={period}
              variant={viewPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewPeriod(period)}
            >
              {period === 'day' ? 'Ngày' : 
               period === 'week' ? 'Tuần' : 
               period === 'month' ? 'Tháng' : 'Năm'}
            </Button>
          ))}
        </div>
      </div>

      {/* Water Intake Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            Lượng nước uống
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">Mục tiêu hàng ngày</span>
              <span className="font-medium">{dailyWaterGoal}ml</span>
            </div>
            
            <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${waterPercentage}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">{waterIntake}ml</span>
              <Badge variant={waterPercentage >= 100 ? 'default' : 'secondary'}>
                {waterPercentage.toFixed(0)}%
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => addWater(100)}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-1" />
                +100ml
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => addWater(200)}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-1" />
                +200ml
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => addWater(-100)}
                disabled={waterIntake === 0}
              >
                <Minus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weight and Waist Circumference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Weight className="w-5 h-5 text-green-500" />
              Cân nặng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70.5"
                  className="flex-1 px-3 py-2 border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  step="0.1"
                />
                <span className="text-sm text-[var(--text-muted)]">kg</span>
              </div>
              {todayData?.weight && (
                <div className="text-sm text-[var(--text-muted)]">
                  Lần cuối: {todayData.weight}kg
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="w-5 h-5 text-purple-500" />
              Vòng bụng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={waistCircumference}
                  onChange={(e) => setWaistCircumference(e.target.value)}
                  placeholder="85"
                  className="flex-1 px-3 py-2 border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  step="0.1"
                />
                <span className="text-sm text-[var(--text-muted)]">cm</span>
              </div>
              {todayData?.waistCircumference && (
                <div className="text-sm text-[var(--text-muted)]">
                  Lần cuối: {todayData.waistCircumference}cm
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <Button onClick={saveHealthData} className="w-full">
        Lưu dữ liệu sức khỏe
      </Button>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            Thống kê {viewPeriod === 'day' ? 'hôm nay' : 
                     viewPeriod === 'week' ? '7 ngày qua' : 
                     viewPeriod === 'month' ? '30 ngày qua' : '365 ngày qua'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredData.reduce((sum, d) => sum + d.waterIntake, 0)}ml
              </div>
              <div className="text-sm text-[var(--text-muted)]">Tổng nước uống</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredData.filter(d => d.weight).length > 0 
                  ? (filteredData.reduce((sum, d) => sum + (d.weight || 0), 0) / filteredData.filter(d => d.weight).length).toFixed(1)
                  : '-'}kg
              </div>
              <div className="text-sm text-[var(--text-muted)]">Trung bình cân nặng</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {filteredData.filter(d => d.waistCircumference).length > 0
                  ? (filteredData.reduce((sum, d) => sum + (d.waistCircumference || 0), 0) / filteredData.filter(d => d.waistCircumference).length).toFixed(1)
                  : '-'}cm
              </div>
              <div className="text-sm text-[var(--text-muted)]">Trung bình vòng bụng</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
