import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  Label, 
  LabelList 
} from 'recharts';

const MenuVarietyAnalysis = () => {
  // State variables
  const [data, setData] = useState([]);
  const [selectedView, setSelectedView] = useState('timeline');
  const [loading, setLoading] = useState(true);
  const [diversityScores, setDiversityScores] = useState([]);
  const [itemFrequency, setItemFrequency] = useState([]);
  const [selectedMenuType, setSelectedMenuType] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('All Customers');
  const [customerTimelineData, setCustomerTimelineData] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [itemRepetitionData, setItemRepetitionData] = useState([]);
  const [repeatedItemsList, setRepeatedItemsList] = useState([]);
  const [menuTypes, setMenuTypes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: 'count',
    direction: 'descending'
  });

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c', '#d084d0', '#ffb347'];

  useEffect(() => {
    const loadData = async () => {
      try {
        const fileContent = await window.fs.readFile('combined_df.csv', { encoding: 'utf8' });
        
        const parsedData = Papa.parse(fileContent, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        setData(parsedData.data);
        
        // Get list of unique menu types and customers
        const uniqueMenuTypes = [...new Set(parsedData.data.map(row => row.menu_type))].sort();
        setMenuTypes(uniqueMenuTypes);
        
        const uniqueCustomers = [...new Set(parsedData.data.map(row => row.customer_name))].sort();
        setCustomers(['All Customers', ...uniqueCustomers]);
        
        // Extract all dates and sort them
        const allDates = [...new Set(parsedData.data.map(row => row.date))].sort();
        
        if (allDates.length > 0) {
          // Set default date range to first and last date
          setDateRange({
            start: allDates[0],
            end: allDates[allDates.length - 1]
          });
        }
        
        // Run analysis
        analyzeMenuVariety(parsedData.data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const analyzeMenuVariety = (data) => {
    // Calculate diversity metrics per menu type
    const menuTypeDiversity = {};
    const itemFreq = {};

    data.forEach(row => {
      const customer = row.customer_name;
      const date = row.date;
      const item = row.material_description;
      const menuType = row.menu_type;
      
      // Menu type diversity tracking
      if (!menuTypeDiversity[menuType]) {
        menuTypeDiversity[menuType] = {
          uniqueItems: new Set(),
          dateItems: {},
          customers: new Set(),
          totalOrders: 0,
          itemHistory: []
        };
      }
      
      menuTypeDiversity[menuType].uniqueItems.add(item);
      menuTypeDiversity[menuType].customers.add(customer);
      menuTypeDiversity[menuType].totalOrders++;
      menuTypeDiversity[menuType].itemHistory.push({ date, item, customer });
      
      if (!menuTypeDiversity[menuType].dateItems[date]) {
        menuTypeDiversity[menuType].dateItems[date] = new Set();
      }
      menuTypeDiversity[menuType].dateItems[date].add(item);
      
      // Item frequency tracking
      if (!itemFreq[item]) {
        itemFreq[item] = {
          count: 0,
          customers: new Set(),
          dates: new Set(),
          menuTypes: new Set()
        };
      }
      itemFreq[item].count++;
      itemFreq[item].customers.add(customer);
      itemFreq[item].dates.add(date);
      itemFreq[item].menuTypes.add(menuType);
    });

    // Calculate diversity scores
    const scores = Object.entries(menuTypeDiversity).map(([menuType, data]) => {
      const customerStats = {
        count: data.customers.size
      };
      
      return {
        menuType,
        totalUniqueItems: data.uniqueItems.size,
        totalOrders: data.totalOrders,
        diversityRatio: data.uniqueItems.size / data.totalOrders,
        avgItemsPerDay: Object.values(data.dateItems).reduce((sum, items) => sum + items.size, 0) / 
                         Math.max(1, Object.keys(data.dateItems).length),
        totalDays: Object.keys(data.dateItems).length,
        customerStats,
        customerCount: data.customers.size,
        itemHistory: data.itemHistory
      };
    });

    scores.sort((a, b) => b.diversityRatio - a.diversityRatio);
    setDiversityScores(scores);
    
    // Process item frequency
    const itemFreqArray = Object.entries(itemFreq).map(([item, data]) => ({
      item,
      count: data.count,
      customerCount: data.customers.size,
      dateCount: data.dates.size,
      menuTypeCount: data.menuTypes.size
    }));

    itemFreqArray.sort((a, b) => b.count - a.count);
    setItemFrequency(itemFreqArray);
    
    // Set default selected menu type
    if (scores.length > 0) {
      setSelectedMenuType(scores[0].menuType);
    }
  };

  useEffect(() => {
    if (selectedMenuType && dateRange.start && dateRange.end && data.length > 0) {
      analyzeItemRepetition(selectedMenuType, dateRange.start, dateRange.end, selectedCustomer);
    }
  }, [selectedMenuType, dateRange, selectedCustomer, data]);

  const analyzeItemRepetition = (menuType, startDate, endDate, customer) => {
    // Filter data for the selected menu type and date range
    const filteredData = data.filter(row => {
      const menuTypeMatch = row.menu_type === menuType;
      const dateMatch = row.date >= startDate && row.date <= endDate;
      const customerMatch = customer === 'All Customers' || row.customer_name === customer;
      
      return menuTypeMatch && dateMatch && customerMatch;
    });
    
    // Count occurrences of each item
    const itemCounts = {};
    filteredData.forEach(row => {
      const item = row.material_description;
      if (!itemCounts[item]) {
        itemCounts[item] = {
          count: 0,
          dates: new Set(),
          customers: new Set()
        };
      }
      itemCounts[item].count++;
      itemCounts[item].dates.add(row.date);
      itemCounts[item].customers.add(row.customer_name);
    });
    
    // Convert to array for easier manipulation
    const itemsArray = Object.entries(itemCounts).map(([item, data]) => ({
      item,
      count: data.count,
      uniqueDates: data.dates.size,
      uniqueCustomers: data.customers.size,
      repeatFactor: data.count / Math.max(1, data.dates.size) // Average times item appears per date
    }));
    
    // Sort by count (highest first)
    itemsArray.sort((a, b) => b.count - a.count);
    
    // Prepare data for charts
    setRepeatedItemsList(itemsArray);
    
    // Count items by repetition frequency
    const repetitionCounts = {
      'Appeared once': 0,
      'Repeated 2-3 times': 0,
      'Repeated 4-5 times': 0,
      'Repeated 6-10 times': 0,
      'Repeated 11+ times': 0
    };
    
    itemsArray.forEach(item => {
      if (item.count === 1) {
        repetitionCounts['Appeared once']++;
      } else if (item.count >= 2 && item.count <= 3) {
        repetitionCounts['Repeated 2-3 times']++;
      } else if (item.count >= 4 && item.count <= 5) {
        repetitionCounts['Repeated 4-5 times']++;
      } else if (item.count >= 6 && item.count <= 10) {
        repetitionCounts['Repeated 6-10 times']++;
      } else {
        repetitionCounts['Repeated 11+ times']++;
      }
    });
    
    const repetitionData = Object.entries(repetitionCounts).map(([category, count]) => ({
      category,
      count
    }));
    
    setItemRepetitionData(repetitionData);
  };
  
  useEffect(() => {
    if (selectedCustomer !== 'All Customers' && dateRange.start && dateRange.end && data.length > 0) {
      analyzeCustomerTimeline(selectedCustomer, dateRange.start, dateRange.end);
    }
  }, [selectedCustomer, dateRange, data]);

  const analyzeCustomerTimeline = (customer, startDate, endDate) => {
    // Filter data for the selected customer and date range
    const filteredData = data.filter(row => {
      const customerMatch = row.customer_name === customer;
      const dateMatch = row.date >= startDate && row.date <= endDate;
      
      return customerMatch && dateMatch;
    });
    
    // Group by date and menu type
    const dateMenuTypeGroups = {};
    
    filteredData.forEach(row => {
      const date = row.date;
      const menuType = row.menu_type;
      const key = `${date}-${menuType}`;
      
      if (!dateMenuTypeGroups[key]) {
        dateMenuTypeGroups[key] = {
          date,
          menuType,
          uniqueItems: new Set(),
          totalItems: 0
        };
      }
      
      dateMenuTypeGroups[key].uniqueItems.add(row.material_description);
      dateMenuTypeGroups[key].totalItems++;
    });
    
    // Convert to array for timeline visualization
    const timelineData = Object.values(dateMenuTypeGroups).map(group => ({
      date: group.date,
      menuType: group.menuType,
      uniqueItems: group.uniqueItems.size,
      totalItems: group.totalItems,
      repeatedItems: group.totalItems - group.uniqueItems.size,
      variety: group.uniqueItems.size / group.totalItems
    }));
    
    // Sort by date
    timelineData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    setCustomerTimelineData(timelineData);
  };

  // Sorting function for table
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortedItems = (items) => {
    if (!items || items.length === 0) return [];
    
    const sortableItems = [...items];
    sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  };

  // Format date for better readability
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
  };
  
  // Format for tooltip display
  const formatTooltip = (value, name, props) => {
    if (name === "variety") {
      return [`${(value * 100).toFixed(1)}%`, "Variety Score"];
    }
    return [value, name];
  };

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Menu Item Repetition Analysis</h1>
        <div className="p-8 text-center">
          <p className="text-lg">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Menu Item Repetition Analysis</h1>
      
      <div className="mb-4">
        <button
          onClick={() => setSelectedView('diversity')}
          className={`px-4 py-2 mr-2 rounded ${selectedView === 'diversity' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Menu Type Diversity
        </button>
        <button
          onClick={() => setSelectedView('items')}
          className={`px-4 py-2 mr-2 rounded ${selectedView === 'items' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Item Frequency
        </button>
        <button
          onClick={() => setSelectedView('timeline')}
          className={`px-4 py-2 mr-2 rounded ${selectedView === 'timeline' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Menu Type Timeline
        </button>
        <button
          onClick={() => setSelectedView('customer-timeline')}
          className={`px-4 py-2 rounded ${selectedView === 'customer-timeline' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Customer Timeline
        </button>
      </div>

      {selectedView === 'timeline' && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="mb-6">
            {/* First row: Menu Type and Customer in one horizontal line */}
            <div className="flex flex-col md:flex-row md:items-end mb-4 space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Select Menu Type:</label>
                <select 
                  value={selectedMenuType}
                  onChange={(e) => setSelectedMenuType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {menuTypes && menuTypes.map(menuType => (
                    <option key={menuType} value={menuType}>
                      {menuType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Select Customer:</label>
                <select 
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {customers && customers.map(customer => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Second row: Start Date and End Date in one horizontal line */}
            <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Start Date:</label>
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">End Date:</label>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">
            Item Repetition Analysis for {selectedMenuType}
            {selectedCustomer !== 'All Customers' && ` - ${selectedCustomer}`}
          </h2>
          
          {repeatedItemsList.length === 0 && (
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200 text-center">
              <p>No data available for the selected menu type and date range. Try adjusting your filters.</p>
            </div>
          )}
          
          {repeatedItemsList.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">Item Repetition Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={itemRepetitionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis>
                      <Label
                        value="Number of Items"
                        position="insideLeft"
                        angle={-90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" name="Number of Items">
                      <LabelList dataKey="count" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">Top Repeated Items</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={repeatedItemsList.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="item" angle={-45} textAnchor="end" height={120} />
                    <YAxis>
                      <Label
                        value="Times Repeated"
                        position="insideLeft"
                        angle={-90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d" name="Times Repeated">
                      <LabelList dataKey="count" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {repeatedItemsList.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">
                Repeated Items Details 
                <span className="text-sm font-normal ml-2">(Click column headers to sort)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('item')}
                      >
                        Item
                        {sortConfig.key === 'item' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('count')}
                      >
                        Total Appearances
                        {sortConfig.key === 'count' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('uniqueDates')}
                      >
                        Unique Dates
                        {sortConfig.key === 'uniqueDates' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('uniqueCustomers')}
                      >
                        Unique Customers
                        {sortConfig.key === 'uniqueCustomers' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('repeatFactor')}
                      >
                        Repeat Factor
                        {sortConfig.key === 'repeatFactor' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedItems(repeatedItemsList).slice(0, 20).map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-4 border-b">{item.item}</td>
                        <td className="py-2 px-4 border-b text-center">{item.count}</td>
                        <td className="py-2 px-4 border-b text-center">{item.uniqueDates}</td>
                        <td className="py-2 px-4 border-b text-center">{item.uniqueCustomers}</td>
                        <td className="py-2 px-4 border-b text-center">{item.repeatFactor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {repeatedItemsList.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Summary Statistics</h3>
                <div>
                  <p><strong>Total Unique Items:</strong> {repeatedItemsList.length}</p>
                  <p><strong>Total Item Appearances:</strong> {repeatedItemsList.reduce((sum, item) => sum + item.count, 0)}</p>
                  <p><strong>Items Appearing Once:</strong> {itemRepetitionData.find(d => d.category === 'Appeared once')?.count || 0} items ({((itemRepetitionData.find(d => d.category === 'Appeared once')?.count || 0) / repeatedItemsList.length * 100).toFixed(1)}%)</p>
                  <p><strong>Items Repeated 11+ times:</strong> {itemRepetitionData.find(d => d.category === 'Repeated 11+ times')?.count || 0} items</p>
                  <p><strong>Average Repetitions:</strong> {(repeatedItemsList.reduce((sum, item) => sum + item.count, 0) / Math.max(1, repeatedItemsList.length)).toFixed(2)} times per item</p>
                  <p><strong>Customer Filter:</strong> {selectedCustomer === 'All Customers' ? 'All Customers (no filter)' : selectedCustomer}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Insights & Definitions</h3>
                <p><strong>Total Appearances:</strong> Total number of times an item appears in the menu</p>
                <p><strong>Unique Dates:</strong> Number of different dates the item appears</p>
                <p><strong>Repeat Factor:</strong> Average number of times the item appears per date</p>
                <p><strong>Higher repeat factor indicates more frequent repetition</strong></p>
                <p><strong>Customer Analysis:</strong> Filter by customer to compare menu variety across different customers</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {selectedView === 'customer-timeline' && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="mb-6">
            {/* First row: Customer selection */}
            <div className="flex flex-col md:flex-row md:items-end mb-4 space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Select Customer:</label>
                <select 
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {customers && customers.map(customer => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <div className="h-6"></div> {/* Spacer to align with other row */}
                {selectedCustomer === 'All Customers' && (
                  <div className="px-3 py-2 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md">
                    Please select a specific customer for timeline analysis
                  </div>
                )}
              </div>
            </div>
            
            {/* Second row: Date range selection */}
            <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Start Date:</label>
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">End Date:</label>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">
            Customer Timeline Analysis for {selectedCustomer}
          </h2>
          
          {(selectedCustomer === 'All Customers' || customerTimelineData.length === 0) && (
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200 text-center">
              <p>{selectedCustomer === 'All Customers' 
                ? 'Please select a specific customer to view their timeline analysis.' 
                : 'No data available for the selected customer and date range. Try adjusting your filters.'}
              </p>
            </div>
          )}
          
          {selectedCustomer !== 'All Customers' && customerTimelineData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">Menu Variety Timeline</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={customerTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                    />
                    <YAxis yAxisId="left">
                      <Label
                        value="Item Count"
                        position="insideLeft"
                        angle={-90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <YAxis yAxisId="right" orientation="right" domain={[0, 1]}>
                      <Label
                        value="Variety Score"
                        position="insideRight"
                        angle={90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip 
                      formatter={formatTooltip} 
                      labelFormatter={formatDate}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded shadow-sm">
                              <p className="font-semibold">{formatDate(data.date)} - {data.menuType}</p>
                              <p>Unique Items: {data.uniqueItems}</p>
                              <p>Total Items: {data.totalItems}</p>
                              <p>Repeated Items: {data.repeatedItems}</p>
                              <p>Variety Score: {(data.variety * 100).toFixed(1)}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="uniqueItems" 
                      stroke="#8884d8" 
                      name="Unique Items" 
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="totalItems" 
                      stroke="#ffc658" 
                      name="Total Items" 
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="repeatedItems" 
                      stroke="#ff7c7c" 
                      name="Repeated Items" 
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="variety" 
                      stroke="#82ca9d" 
                      name="Variety Score" 
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {selectedCustomer !== 'All Customers' && customerTimelineData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Timeline Details by Date and Menu Type</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b">Date</th>
                      <th className="py-2 px-4 border-b">Menu Type</th>
                      <th className="py-2 px-4 border-b">Unique Items</th>
                      <th className="py-2 px-4 border-b">Total Items</th>
                      <th className="py-2 px-4 border-b">Repeated Items</th>
                      <th className="py-2 px-4 border-b">Variety Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerTimelineData.map((day, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-4 border-b">{formatDate(day.date)}</td>
                        <td className="py-2 px-4 border-b">{day.menuType}</td>
                        <td className="py-2 px-4 border-b text-center">{day.uniqueItems}</td>
                        <td className="py-2 px-4 border-b text-center">{day.totalItems}</td>
                        <td className="py-2 px-4 border-b text-center">{day.repeatedItems}</td>
                        <td className="py-2 px-4 border-b text-center">{(day.variety * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedCustomer !== 'All Customers' && customerTimelineData.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Customer Timeline Statistics</h3>
                <div>
                  <p><strong>Total Days with Orders:</strong> {new Set(customerTimelineData.map(item => item.date)).size}</p>
                  <p><strong>Total Menu Types Used:</strong> {new Set(customerTimelineData.map(item => item.menuType)).size}</p>
                  <p><strong>Average Variety Score:</strong> {(customerTimelineData.reduce((sum, day) => sum + day.variety, 0) / customerTimelineData.length * 100).toFixed(1)}%</p>
                  <p><strong>Average Unique Items per Day-Menu:</strong> {(customerTimelineData.reduce((sum, day) => sum + day.uniqueItems, 0) / customerTimelineData.length).toFixed(1)}</p>
                  <p><strong>Average Total Items per Day-Menu:</strong> {(customerTimelineData.reduce((sum, day) => sum + day.totalItems, 0) / customerTimelineData.length).toFixed(1)}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Insights & Definitions</h3>
                <p><strong>Timeline Analysis:</strong> Shows how menu variety changes over time for this customer</p>
                <p><strong>Menu Type Breakdown:</strong> Reveals patterns across different meal types</p>
                <p><strong>Day-Menu:</strong> A specific combination of date and menu type</p>
                <p><strong>Variety Score:</strong> Unique Items ÷ Total Items (higher means more diverse menu)</p>
                <p><strong>Tracking variety over time can reveal customer satisfaction trends</strong></p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MenuVarietyAnalysis;